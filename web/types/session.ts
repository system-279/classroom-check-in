export type SessionStatus = "open" | "closed" | "adjusted";

export type SessionSource = "manual" | "video" | "test" | "reports";

export type Session = {
  id: string;
  courseId: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  durationSec: number;
  source: SessionSource;
  confidence: number | null;
  status: SessionStatus;
  lastHeartbeatAt: string;
};

export type CheckInRequest = {
  courseId: string;
};

export type CheckInResponse = {
  session: Session;
  alreadyOpen?: boolean;
};

export type HeartbeatRequest = {
  sessionId: string;
};

export type HeartbeatResponse = {
  status: "ok";
};

export type CheckOutRequest = {
  sessionId: string;
  at?: string;
};

export type CheckOutResponse = {
  session: Session;
};

export type ActiveSessionResponse = {
  session: Session | null;
};
