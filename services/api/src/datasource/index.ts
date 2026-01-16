/**
 * DataSource エクスポート
 */

export type { DataSource } from "./interface.js";
export { ReadOnlyDataSourceError } from "./interface.js";
export { InMemoryDataSource } from "./in-memory.js";
export { FirestoreDataSource } from "./firestore.js";
export { getDataSource, type TenantContext } from "./factory.js";
