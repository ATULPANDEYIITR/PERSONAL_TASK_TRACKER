export type Status='NOT_STARTED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED';
export type Priority='URGENT'|'HIGH'|'MEDIUM'|'LOW';
export type Theme='light'|'dark'|'system';
export interface Activity { id:string; type:string; text:string; at:string }
export interface Task { id:string; title:string; description:string; status:Status; priority:Priority; majorHead:string; subArea:string; projectId:string; tags:string[]; dueDate:string|null; startDate:string|null; estimatedMinutes:number|null; reminder:string|null; notes:string; recurring:string|null; createdAt:string; updatedAt:string; completedAt:string|null; deletedAt:string|null; activity:Activity[]; sourceUrl?:string|null }
export interface Project { id:string; name:string; description:string; color:string; createdAt:string }
export interface Settings { theme:Theme; weekStartsMonday:boolean; compactMode:boolean; notifications:boolean }
