import {createContext,useContext,useEffect,useMemo,useReducer,useState} from 'react';
import type {ReactNode} from 'react';
import {initialProjects,initialTasks} from '../data/initialData';
import type {Project,Settings,Status,Priority,Task} from '../data/types';

const KEY='ptt:v1';
type State={tasks:Task[];projects:Project[];settings:Settings};
type Action={type:string;payload?:any};
const defaults:State={tasks:initialTasks,projects:initialProjects,settings:{theme:'system',weekStartsMonday:true,compactMode:false,notifications:true}};
function load():State{try{const raw=localStorage.getItem(KEY);if(!raw)return defaults;const p=JSON.parse(raw);return {...defaults,...p,tasks:Array.isArray(p.tasks)?p.tasks:defaults.tasks,projects:Array.isArray(p.projects)?p.projects:defaults.projects,settings:{...defaults.settings,...p.settings}}}catch{return defaults}}
function uid(prefix='id'){return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
function act(text:string,type='updated'):any[]{return [{id:uid('activity'),type,text,at:new Date().toISOString()}]}
function reducer(s:State,a:Action):State{
 const now=new Date().toISOString();
 switch(a.type){
  case 'create':{const t:Task={...a.payload,id:uid('task'),createdAt:now,updatedAt:now,deletedAt:null,completedAt:null,activity:act('Task created','created')};return {...s,tasks:[t,...s.tasks]}}
  case 'update':return {...s,tasks:s.tasks.map(t=>t.id===a.payload.id?{...t,...a.payload.changes,updatedAt:now,activity:[...t.activity,...act('Task updated')]}:t)};
  case 'delete':return {...s,tasks:s.tasks.map(t=>a.payload.includes(t.id)?{...t,deletedAt:now,updatedAt:now,activity:[...t.activity,...act('Moved to trash','deleted')]}:t)};
  case 'restore':return {...s,tasks:s.tasks.map(t=>a.payload.includes(t.id)?{...t,deletedAt:null,updatedAt:now,activity:[...t.activity,...act('Task restored','restored')]}:t)};
  case 'purge':return {...s,tasks:s.tasks.filter(t=>!a.payload.includes(t.id))};
  case 'status':return {...s,tasks:s.tasks.map(t=>t.id===a.payload.id?{...t,status:a.payload.status,completedAt:a.payload.status==='COMPLETED'?now:null,updatedAt:now,activity:[...t.activity,...act(`Status changed to ${a.payload.status}`,'status')]}:t)};
  case 'priority':return {...s,tasks:s.tasks.map(t=>t.id===a.payload.id?{...t,priority:a.payload.priority,updatedAt:now,activity:[...t.activity,...act(`Priority changed to ${a.payload.priority}`,'priority')]}:t)};
  case 'bulkStatus':return {...s,tasks:s.tasks.map(t=>a.payload.ids.includes(t.id)?{...t,status:a.payload.status,completedAt:a.payload.status==='COMPLETED'?now:null,updatedAt:now}:t)};
  case 'bulkPriority':return {...s,tasks:s.tasks.map(t=>a.payload.ids.includes(t.id)?{...t,priority:a.payload.priority,updatedAt:now}:t)};
  case 'bulkDelete':return {...s,tasks:s.tasks.map(t=>a.payload.includes(t.id)?{...t,deletedAt:now,updatedAt:now}:t)};
  case 'duplicate':{const t=s.tasks.find(x=>x.id===a.payload);if(!t)return s;const d={...t,id:uid('task'),title:`${t.title} (copy)`,status:'NOT_STARTED' as Status,completedAt:null,deletedAt:null,createdAt:now,updatedAt:now,activity:act('Task duplicated','created')};return {...s,tasks:[d,...s.tasks]}}
  case 'projectCreate':return {...s,projects:[...s.projects,{...a.payload,id:uid('project'),createdAt:now}]};
  case 'projectDelete':return {...s,projects:s.projects.filter(p=>p.id!==a.payload)};
  case 'settings':return {...s,settings:{...s.settings,...a.payload}};
  case 'replace':return {tasks:a.payload.tasks,projects:a.payload.projects,settings:{...defaults.settings,...a.payload.settings}};
  default:return s;
 }
}
interface Ctx extends State {dispatch:(a:Action)=>void;createTask:(t:Omit<Task,'id'|'createdAt'|'updatedAt'|'deletedAt'|'completedAt'|'activity'>)=>void;updateTask:(id:string,changes:Partial<Task>)=>void;setStatus:(id:string,status:Status)=>void;setPriority:(id:string,priority:Priority)=>void;deleteTasks:(ids:string[])=>void;restoreTasks:(ids:string[])=>void;purgeTasks:(ids:string[])=>void;duplicateTask:(id:string)=>void;addProject:(p:Omit<Project,'id'|'createdAt'>)=>void;removeProject:(id:string)=>void;exportData:()=>void;importData:(data:any,merge:boolean)=>{ok:boolean;error?:string};}
const C=createContext<Ctx|null>(null);
export function TaskProvider({children}:{children:ReactNode}){const [state,dispatch]=useReducer(reducer,undefined,load);const [ready,setReady]=useState(false);useEffect(()=>{setReady(true)},[]);useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify(state))},[state,ready]);
 const api=useMemo<Ctx>(()=>({
  ...state,
  dispatch,
  createTask:t=>dispatch({type:'create',payload:t}),
  updateTask:(id,changes)=>dispatch({type:'update',payload:{id,changes}}),
  setStatus:(id,status)=>dispatch({type:'status',payload:{id,status}}),
  setPriority:(id,priority)=>dispatch({type:'priority',payload:{id,priority}}),
  deleteTasks:ids=>dispatch({type:'delete',payload:ids}),
  restoreTasks:ids=>dispatch({type:'restore',payload:ids}),
  purgeTasks:ids=>dispatch({type:'purge',payload:ids}),
  duplicateTask:id=>dispatch({type:'duplicate',payload:id}),
  addProject:p=>dispatch({type:'projectCreate',payload:p}),
  removeProject:id=>dispatch({type:'projectDelete',payload:id}),
  exportData:()=>{
   const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`personal-task-tracker-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
  },
  importData:(data,merge)=>{
   try{
    if(!data||!Array.isArray(data.tasks)||!Array.isArray(data.projects))throw new Error('Invalid backup format');
    const tasks=data.tasks.map((t:any)=>({...t,id:String(t.id||uid('task')),activity:Array.isArray(t.activity)?t.activity:[]}));
    if(!window.confirm(merge?'Merge this backup into the current workspace?':'Replace the current workspace with this backup?')) return {ok:false,error:'Import cancelled'};
    dispatch({type:'replace',payload:merge?{tasks:[...state.tasks,...tasks],projects:[...state.projects,...data.projects],settings:{...state.settings,...data.settings}}:data});
    return {ok:true};
   }catch(e){return {ok:false,error:e instanceof Error?e.message:'Import failed'}}
  }
 }),[state]);
 return <C.Provider value={api}>{children}</C.Provider>}
export function useTasks(){const c=useContext(C);if(!c)throw new Error('useTasks must be used inside TaskProvider');return c}
