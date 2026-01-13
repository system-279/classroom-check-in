import { FieldValue } from "@google-cloud/firestore";
import { google } from "googleapis";
import { config } from "../config.js";
import { createAuthClient } from "../google/auth.js";
import { db } from "../storage/firestore.js";

const classroomScopes = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
  "https://www.googleapis.com/auth/classroom.profile.photos",
];

type SyncStats = {
  courses: number;
  students: number;
  teachers: number;
};

const listAllCourses = async () => {
  const auth = await createAuthClient({
    scopes: classroomScopes,
    credentialsPath: config.google.credentialsPath,
    adminSubject: config.google.adminSubject,
  });

  const classroom = google.classroom({ version: "v1", auth });
  const courses: NonNullable<
    Awaited<ReturnType<typeof classroom.courses.list>>["data"]["courses"]
  > = [];

  let pageToken: string | undefined;
  const courseStates = ["ACTIVE"];
  if (config.classroom.includeArchived) {
    courseStates.push("ARCHIVED");
  }

  do {
    const res = await classroom.courses.list({
      pageSize: config.classroom.pageSize,
      pageToken,
      courseStates,
    });

    if (res.data.courses) {
      courses.push(...res.data.courses);
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return courses;
};

const listPeople = async (
  role: "students" | "teachers",
  courseId: string,
) => {
  const auth = await createAuthClient({
    scopes: classroomScopes,
    credentialsPath: config.google.credentialsPath,
    adminSubject: config.google.adminSubject,
  });

  const classroom = google.classroom({ version: "v1", auth });
  const people: Array<
    | NonNullable<
        Awaited<ReturnType<typeof classroom.courses.students.list>>["data"]["students"]
      >[number]
    | NonNullable<
        Awaited<ReturnType<typeof classroom.courses.teachers.list>>["data"]["teachers"]
      >[number]
  > = [];

  let pageToken: string | undefined;
  do {
    const res =
      role === "students"
        ? await classroom.courses.students.list({
            courseId,
            pageSize: config.classroom.pageSize,
            pageToken,
          })
        : await classroom.courses.teachers.list({
            courseId,
            pageSize: config.classroom.pageSize,
            pageToken,
          });

    if (role === "students" && res.data.students) {
      people.push(...res.data.students);
    }
    if (role === "teachers" && res.data.teachers) {
      people.push(...res.data.teachers);
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return people;
};

const upsertUser = async (
  userId: string,
  profile?: {
    name?: { fullName?: string; givenName?: string; familyName?: string } | null;
    emailAddress?: string | null;
    photoUrl?: string | null;
  } | null,
) => {
  const data = {
    externalId: userId,
    email: profile?.emailAddress || null,
    name: profile?.name?.fullName || null,
    givenName: profile?.name?.givenName || null,
    familyName: profile?.name?.familyName || null,
    photoUrl: profile?.photoUrl || null,
    syncedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("users").doc(userId).set(data, { merge: true });
};

const upsertEnrollment = async (
  courseId: string,
  userId: string,
  role: "student" | "teacher",
) => {
  const enrollmentId = `${courseId}_${userId}_${role}`;
  await db.collection("enrollments").doc(enrollmentId).set(
    {
      courseId,
      userId,
      role,
      startAt: null,
      endAt: null,
      syncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
};

export const syncClassroom = async () => {
  const stats: SyncStats = { courses: 0, students: 0, teachers: 0 };

  const courses = await listAllCourses();
  stats.courses = courses.length;

  for (const course of courses) {
    if (!course.id) {
      continue;
    }

    await db.collection("courses").doc(course.id).set(
      {
        externalCourseId: course.id,
        name: course.name ?? null,
        classroomUrl: course.alternateLink ?? null,
        courseState: course.courseState ?? null,
        creationTime: course.creationTime ?? null,
        updateTime: course.updateTime ?? null,
        syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (config.classroom.syncStudents) {
      const students = await listPeople("students", course.id);
      for (const student of students) {
        const userId = student.userId;
        if (!userId) {
          continue;
        }
        await upsertUser(userId, student.profile);
        await upsertEnrollment(course.id, userId, "student");
        stats.students += 1;
      }
    }

    if (config.classroom.syncTeachers) {
      const teachers = await listPeople("teachers", course.id);
      for (const teacher of teachers) {
        const userId = teacher.userId;
        if (!userId) {
          continue;
        }
        await upsertUser(userId, teacher.profile);
        await upsertEnrollment(course.id, userId, "teacher");
        stats.teachers += 1;
      }
    }
  }

  await db.collection("syncRuns").add({
    task: "classroom-sync",
    stats,
    completedAt: FieldValue.serverTimestamp(),
  });

  return stats;
};
