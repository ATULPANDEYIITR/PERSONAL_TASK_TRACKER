import type {Priority,Status,Task} from '../data/types';
export const statusLabels:Record<Status,string>={NOT_STARTED:'Not Started',IN_PROGRESS:'In Progress',COMPLETED:'Completed',CANCELLED:'Cancelled'};
export const priorityLabels:Record<Priority,string>={URGENT:'Urgent',HIGH:'High',MEDIUM:'Medium',LOW:'Low'};
export function isOverdue(t:Task,now=new Date()){return !!t.dueDate&&t.status!=='COMPLETED'&&t.status!=='CANCELLED'&&new Date(t.dueDate)<now}
export function isToday(t:Task,now=new Date()){if(!t.dueDate)return false;const d=new Date(t.dueDate);return d.toDateString()===now.toDateString()}
export function fmtDate(v:string|null){if(!v)return 'No date';return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(v))}
export function fmtShort(v:string|null){if(!v)return '—';return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(v))}
export function rankPriority(p:Priority){return {URGENT:4,HIGH:3,MEDIUM:2,LOW:1}[p]}
export function filterTasks(tasks:Task[],q:string){const s=q.trim().toLowerCase();if(!s)return tasks;return tasks.filter(t=>[t.title,t.description,t.notes,t.majorHead,t.subArea,t.tags.join(' ')].join(' ').toLowerCase().includes(s))}
