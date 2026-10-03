export const criteria=[['Originality & Creativity',20,'A fresh idea with an original point of view.'],['Innovation & Technology',20,'Thoughtful use of technology to make change.'],['Relevance to SD College',15,'Addresses a real need within our college.'],['Clarity of Problem & Solution',15,'A clear problem and a convincing solution.'],['Features & Working',10,'Useful features and a clear working approach.'],['Impact & Feasibility',10,'Meaningful impact with a practical plan.'],['Visual Design & Presentation',10,'A balanced, readable and engaging poster.']];
export function initialState(){return {judges:[{id:'girdhar',name:'Dr. Girdhar Gopal',token:null},{id:'aarti',name:'Dr. Aarti Arora',token:null},{id:'kavleen',name:'Ms. Kavleen Bharej',token:null}],scores:{},finalized:false};}
export function complete(state,students){return students.length>0&&state.judges.length>0&&state.judges.every(j=>students.every(s=>state.scores[j.id]?.[s.id]));}
export function ranking(state,students){let last=null,rank=0;return students.map(s=>{const total=state.judges.reduce((n,j)=>n+state.scores[j.id][s.id].reduce((a,b)=>a+b,0),0);return {...s,total,average:total/state.judges.length};}).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name)).map((s,i)=>{if(s.total!==last)rank=i+1;last=s.total;return {...s,rank};});}
export function mutate(state,action,students){
 students=state.students||students;
 if(action.type==='bootstrap-students'){if(!state.students)state.students=action.students;return state;}
 if(['student-add','student-update','student-delete'].includes(action.type)){
  if(state.finalized)throw Error('Final results are locked. Entries cannot be changed.');
  state.students??=structuredClone(students);
  const index=state.students.findIndex(s=>s.id===action.student?.id||s.id===action.id);
  if(action.type==='student-delete'){
   if(index<0)throw Error('Entry not found.');
   if(state.students.length<=1)throw Error('Keep at least one entry in the event.');
   const [removed]=state.students.splice(index,1);
   state.archivedStudents??=[];state.archivedStudents.push({...removed,deletedAt:action.deletedAt});
   if(complete(state,state.students))state.finalized=true;
   return state;
  }
  const s=action.student;
  if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||typeof s.course!=='string'||!s.course.trim()||s.course.length>120||typeof s.roll!=='string'||!s.roll.trim()||s.roll.length>40)throw Error('Enter a name, course and roll number within the allowed limits.');
  if(state.students.some(x=>x.roll.trim().toLowerCase()===s.roll.trim().toLowerCase()&&x.id!==s.id))throw Error('This roll number already has an entry.');
  if(action.type==='student-add'){
   if(!Array.isArray(s.assets)||!s.assets.length||s.assets.length>6)throw Error('Upload one to six posters.');
   state.students.push({...s,name:s.name.trim(),course:s.course.trim(),roll:s.roll.trim()});
  }else{
   if(index<0)throw Error('Entry not found.');
   state.students[index]={...state.students[index],name:s.name.trim(),course:s.course.trim(),roll:s.roll.trim()};
  }
  return state;
 }
 if(action.type==='claim'){const j=state.judges.find(j=>j.id===action.id);if(!j||!action.token)throw Error('Judge not found or session missing.');if(state.judges.some(x=>x.token===action.token&&x.id!==action.id))throw Error('This device already has a judge session.');if(j.token&&j.token!==action.token)throw Error('This judge is already in use on another device.');if(!j.token)j.token=action.token;return state;}
 if(action.type==='add'){if(state.finalized)throw Error('Results are locked.');const name=action.name?.trim();if(!name||name.length>80)throw Error('Enter a judge name (up to 80 characters).');if(state.judges.some(j=>j.name.toLowerCase()===name.toLowerCase()))throw Error('That judge already exists.');state.judges.push({id:action.id,name,token:null});return state;}
 if(action.type==='release'){if(state.finalized)throw Error('Results are locked.');const j=state.judges.find(j=>j.id===action.id);if(!j)throw Error('Judge not found.');j.token=null;return state;}
 if(action.type==='score'){if(state.finalized)throw Error('Final results have been published. Scores are now locked.');const j=state.judges.find(j=>j.id===action.id);if(!j||!j.token||j.token!==action.token)throw Error('Your judge session is no longer active.');if(!students.some(s=>s.id===action.student))throw Error('Student not found.');if(!Array.isArray(action.marks)||action.marks.length!==7||action.marks.some((n,i)=>!Number.isInteger(n)||n<0||n>criteria[i][1]))throw Error('Enter whole-number marks within each criterion’s limit.');state.scores[j.id]??={};state.scores[j.id][action.student]=action.marks;if(complete(state,students))state.finalized=true;return state;}
 throw Error('Unknown action.');
}
