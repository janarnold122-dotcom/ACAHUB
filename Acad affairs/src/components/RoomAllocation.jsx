import React, { useState, useEffect } from 'react';
import { DB, logAction, api } from '../data/mockDb';
import { notifyDataChanged } from '../data/DataContext';
import { Badge } from './Badge';

/* ===================== Room Allocation ===================== */
export function RoomAllocation() {
  const [rooms,setRooms] = useState([]);
  const [showForm,setShowForm] = useState(false);
  const [form,setForm] = useState({name:"", building:"", capacity:30, room_type:"lecture"});
  
  useEffect(()=>{ api("/rooms/occupancy").then(setRooms); },[]);

  async function submitRoom(e){
    e.preventDefault();
    try {
      await api("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          building: form.building,
          capacity: Number(form.capacity),
          room_type: form.room_type,
        })
      });
    } catch {
      DB.rooms.push({
        id: DB.rooms.length + 1,
        name: form.name,
        building: form.building,
        capacity: Number(form.capacity),
        room_type: form.room_type
      });
    }
    logAction("VPAA", "Created new room", `${form.name} in ${form.building}`);
    setShowForm(false);
    setForm({name:"", building:"", capacity:30, room_type:"lecture"});
    api("/rooms/occupancy").then(setRooms);
    notifyDataChanged();
  }

  async function deleteRoom(roomId, roomName){
    if(confirm(`Are you sure you want to delete ${roomName}?`)){
      try {
        await api(`/rooms/${roomId}`, { method: "DELETE" });
      } catch {
        DB.rooms = DB.rooms.filter(r=>r.id!==roomId);
        DB.schedules = DB.schedules.filter(s=>s.room_id!==roomId);
      }
      logAction("VPAA", "Deleted room", roomName);
      api("/rooms/occupancy").then(setRooms);
      notifyDataChanged();
    }
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Add new room</button>
      </div>
      
      <div className="section-title"><h3>Room &amp; facility allocation matrix</h3><span className="hint">Utilization vs. 72 weekly slots (Mon&ndash;Sat, 07:00&ndash;19:00)</span></div>
      <div className="grid grid-3">
        {rooms.map(r=>(
          <div className="card" key={r.room_id}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
              <div>
                <h4 style={{fontSize:15}}>{r.room_name}</h4>
                <div style={{fontSize:12, color:"var(--slate)"}}>{r.building}</div>
              </div>
              <Badge kind={r.room_type==="lecture"?"neutral":"gold"}>{r.room_type.replace('_',' ')}</Badge>
            </div>
            <div style={{margin:"12px 0 6px", fontSize:12, color:"var(--slate)"}}>Capacity {r.capacity} &middot; {r.scheduled_classes} classes/week</div>
            <div className="load-bar-track"><div className={"load-bar-fill"+(r.utilization_pct>70?" over":"")} style={{width:`${Math.min(100,r.utilization_pct)}%`}}></div></div>
            <div style={{fontSize:11.5, color:"var(--slate)", marginTop:5}}>{r.utilization_pct}% utilized</div>
            <button className="btn btn-sm" style={{color:"var(--alert)", borderColor:"var(--alert)", marginTop:10, width:"100%"}} onClick={()=>deleteRoom(r.room_id, r.room_name)}>Delete</button>
          </div>
        ))}
        {rooms.length===0 && <div className="empty">No rooms configured.</div>}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e)=>{if(e.target===e.currentTarget) setShowForm(false);}}>
          <form className="modal" onSubmit={submitRoom}>
            <h3>Create new room</h3>
            <div className="field">
              <label>Room name</label>
              <input required placeholder="e.g. Room 101" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            </div>
            <div className="field">
              <label>Building</label>
              <input required placeholder="e.g. Main Building" value={form.building} onChange={e=>setForm({...form,building:e.target.value})} />
            </div>
            <div className="field">
              <label>Capacity</label>
              <input required type="number" min="1" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} />
            </div>
            <div className="field">
              <label>Room type</label>
              <select value={form.room_type} onChange={e=>setForm({...form,room_type:e.target.value})}>
                <option value="lecture">Lecture</option>
                <option value="computer_lab">Computer Lab</option>
                <option value="science_lab">Science Lab</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={()=>setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create room</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
