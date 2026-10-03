-- Run once in Supabase SQL Editor. Only the server secret key can call these functions.
create table if not exists public.judging_event (
 id integer primary key check (id=1),
 state jsonb not null,
 student_ids jsonb not null
);
alter table public.judging_event enable row level security;
revoke all on public.judging_event from anon, authenticated;
create or replace function public.judging_read() returns jsonb language sql security definer set search_path=public as $$ select state from judging_event where id=1 $$;
create or replace function public.judging_mutate(action jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare s jsonb; ids jsonb; j jsonb; idx integer; k integer; marks jsonb; maxes integer[]:=array[20,20,15,15,10,10,10]; finished boolean; jid text;
begin
 select state,student_ids into s,ids from judging_event where id=1 for update;
 if s is null then raise exception 'Event not initialized'; end if;
 select value,(ordinality-1)::integer into j,idx from jsonb_array_elements(s->'judges') with ordinality where value->>'id'=action->>'id';
 if action->>'type'='bootstrap-students' then
   if s->'students' is null then
     if jsonb_typeof(action->'students') is distinct from 'array' then raise exception 'Invalid student roster'; end if;
     s:=jsonb_set(s,'{students}',action->'students');
     select jsonb_agg(value->>'id') into ids from jsonb_array_elements(s->'students');
   end if;
 elsif action->>'type' in ('student-add','student-update','student-delete') then
   if (s->>'finalized')::boolean then raise exception 'Final results are locked'; end if;
   if s->'students' is null then raise exception 'Student roster not initialized'; end if;
   if action->>'type'='student-delete' then
     select value into j from jsonb_array_elements(s->'students') where value->>'id'=action->>'id';
     if j is null then raise exception 'Entry not found'; end if;
     if jsonb_array_length(s->'students')<=1 then raise exception 'Keep at least one entry'; end if;
     s:=jsonb_set(s,'{archivedStudents}',coalesce(s->'archivedStudents','[]'::jsonb)||jsonb_build_array(j||jsonb_build_object('deletedAt',action->>'deletedAt')));
     select jsonb_agg(value order by ordinality) into marks from jsonb_array_elements(s->'students') with ordinality where value->>'id'<>action->>'id';
     s:=jsonb_set(s,'{students}',marks);
   else
     j:=action->'student';
     if j->>'name' is null or length(trim(j->>'name')) not between 1 and 100 or j->>'course' is null or length(trim(j->>'course')) not between 1 and 120 or j->>'roll' is null or length(trim(j->>'roll')) not between 1 and 40 then raise exception 'Invalid student details'; end if;
     if exists(select 1 from jsonb_array_elements(s->'students') x where lower(trim(x->>'roll'))=lower(trim(j->>'roll')) and x->>'id'<>j->>'id') then raise exception 'Roll number already exists'; end if;
     if action->>'type'='student-add' then
       if jsonb_typeof(j->'assets') is distinct from 'array' then raise exception 'Upload a poster'; end if;
       if jsonb_array_length(j->'assets') not between 1 and 6 then raise exception 'Upload one to six posters'; end if;
       s:=jsonb_set(s,'{students}',s->'students'||jsonb_build_array(j));
     else
       select (ordinality-1)::integer into idx from jsonb_array_elements(s->'students') with ordinality where value->>'id'=j->>'id';
       if idx is null then raise exception 'Entry not found'; end if;
       s:=jsonb_set(s,array['students',idx::text],(s->'students'->idx)||jsonb_build_object('name',trim(j->>'name'),'course',trim(j->>'course'),'roll',trim(j->>'roll')));
     end if;
   end if;
   select jsonb_agg(value->>'id') into ids from jsonb_array_elements(s->'students');
   if action->>'type'='student-delete' then
     select not exists(select 1 from jsonb_array_elements(s->'judges') as judge(item) cross join jsonb_array_elements_text(ids) as student(sid) where s->'scores'->(judge.item->>'id')->student.sid is null) into finished;
     if finished then s:=jsonb_set(s,'{finalized}','true'::jsonb); end if;
   end if;
 elsif action->>'type'='claim' then
   if j is null then raise exception 'Judge not found'; end if;
   if action->>'token' is null then raise exception 'Session required'; end if;
   if j->>'token' is not null and j->>'token'<>action->>'token' then raise exception 'Judge already occupied'; end if;
   if exists(select 1 from jsonb_array_elements(s->'judges') x where x->>'token'=action->>'token' and x->>'id'<>action->>'id') then raise exception 'Device already has a judge'; end if;
   s:=jsonb_set(s,array['judges',idx::text,'token'],action->'token');
 elsif action->>'type'='add' then
   if (s->>'finalized')::boolean then raise exception 'Results locked'; end if;
   if action->>'name' is null or length(trim(action->>'name')) not between 1 and 80 then raise exception 'Invalid name'; end if;
   if exists(select 1 from jsonb_array_elements(s->'judges') x where lower(x->>'name')=lower(trim(action->>'name'))) then raise exception 'Judge exists'; end if;
   s:=jsonb_set(s,'{judges}',(s->'judges')||jsonb_build_array(jsonb_build_object('id',action->>'id','name',trim(action->>'name'),'token',null)));
 elsif action->>'type'='release' then
   if (s->>'finalized')::boolean or j is null then raise exception 'Cannot release judge'; end if;
   s:=jsonb_set(s,array['judges',idx::text,'token'],'null'::jsonb);
 elsif action->>'type'='score' then
   if (s->>'finalized')::boolean then raise exception 'Results locked'; end if;
   if j is null or j->>'token' is null or action->>'token' is null or j->>'token'<>action->>'token' then raise exception 'Invalid judge session'; end if;
   if not ids ? (action->>'student') then raise exception 'Unknown student'; end if;
   marks:=action->'marks';
   if jsonb_typeof(marks) is distinct from 'array' then raise exception 'Invalid marks'; end if;
   if jsonb_array_length(marks)<>7 then raise exception 'Invalid marks'; end if;
   for k in 0..6 loop
     if jsonb_typeof(marks->k)<>'number' or (marks->>k)::numeric<>trunc((marks->>k)::numeric) or (marks->>k)::numeric<0 or (marks->>k)::numeric>maxes[k+1] then raise exception 'Marks out of range'; end if;
   end loop;
   jid:=action->>'id';
   if s->'scores'->jid is null then s:=jsonb_set(s,array['scores',jid],'{}'::jsonb); end if;
   s:=jsonb_set(s,array['scores',jid,action->>'student'],marks);
   select not exists(select 1 from jsonb_array_elements(s->'judges') as judge(item) cross join jsonb_array_elements_text(ids) as student(sid) where s->'scores'->(judge.item->>'id')->student.sid is null) into finished;
   if finished then s:=jsonb_set(s,'{finalized}','true'::jsonb); end if;
 else raise exception 'Invalid action'; end if;
 update judging_event set state=s,student_ids=ids where id=1;
 return s;
end $$;
revoke all on function public.judging_read() from public,anon,authenticated;
revoke all on function public.judging_mutate(jsonb) from public,anon,authenticated;
grant execute on function public.judging_read() to service_role;
grant execute on function public.judging_mutate(jsonb) to service_role;

insert into public.judging_event(id,state,student_ids) values (1,'{"judges":[{"id":"girdhar","name":"Dr. Girdhar Gopal","token":null},{"id":"aarti","name":"Dr. Aarti Arora","token":null},{"id":"kavleen","name":"Ms. Kavleen Bharej","token":null}],"scores":{},"finalized":false}'::jsonb,'["1","2","3","4","5","7","8","9","12","13","14","15","16","17","18","19"]'::jsonb) on conflict (id) do nothing;

-- Uploaded posters are public event assets; only the backend can upload.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('posters','posters',true,15728640,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do nothing;
