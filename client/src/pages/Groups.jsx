// import { useEffect, useState } from "react";
// import api from "../api/axios";
// import { socket } from "../sockets/socket";

// const Groups = () => {
//   const [groups, setGroups] = useState([]);
//   const [message, setMessage] = useState("");
//   const [selectedGroup, setSelectedGroup] = useState(null);
//   const [chat, setChat] = useState([]);

//   useEffect(() => {
//     const fetchGroups = async () => {
//       const res = await api.get("/groups");
//       setGroups(res.data.groups);
//     };
//     fetchGroups();

//     socket.on("new-group-message", (msg) => setChat((prev) => [...prev, msg]));
//     return () => socket.off("new-group-message");
//   }, []);

//   const sendMessage = () => {
//     if (!selectedGroup) return alert("Select a group");
//     socket.emit("group-message", { groupId: selectedGroup._id, message, userId: "me" });
//     setMessage("");
//   };

//   return (
//     <div className="bg-white rounded-xl shadow p-6 flex gap-6">
//       <div className="w-1/4 border-r pr-4">
//         <h2 className="text-xl mb-2">Groups</h2>
//         {groups.map(g => <div key={g._id} className="p-2 cursor-pointer hover:bg-gray-100" onClick={() => setSelectedGroup(g)}>{g.name}</div>)}
//       </div>
//       <div className="flex-1 pl-4">
//         <h2 className="text-xl mb-2">{selectedGroup ? selectedGroup.name : "Select a group"}</h2>
//         <div className="h-64 overflow-y-auto border p-2 mb-2">
//           {chat.map((c, i) => <div key={i}><strong>{c.userId}:</strong> {c.message}</div>)}
//         </div>
//         <div className="flex gap-2">
//           <input className="border p-2 flex-1" value={message} onChange={e => setMessage(e.target.value)} />
//           <button className="bg-purple-600 text-white p-2 rounded" onClick={sendMessage}>Send</button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Groups;
// export default function Groups() {
//   return (
//     <div className="space-y-6">
//       <h1 className="text-2xl font-semibold">Study Groups</h1>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         {["DSA Group", "Electronics Revision", "Exam Prep"].map(
//           (group, i) => (
//             <div
//               key={i}
//               className="bg-white rounded-xl shadow-sm p-4"
//             >
//               <h2 className="font-medium">{group}</h2>
//               <p className="text-sm text-gray-500 mt-1">
//                 Active members collaborating
//               </p>

//               <button className="mt-3 text-sm text-indigo-600 hover:underline">
//                 Enter Group
//               </button>
//             </div>
//           )
//         )}
//       </div>
//     </div>
//   );
// }
import { useState, useEffect } from "react";
import { socket } from "../sockets/socket";

const Groups= () => {
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("session-updated", (data) => setMessages((prev) => [...prev, data]));
    return () => socket.off("session-updated");
  }, []);

  const joinRoom = () => {
    if (roomId) socket.emit("join-study-room", roomId);
  };

  const sendMessage = () => {
    socket.emit("study-session-update", { roomId, sessionData: message });
    setMessage("");
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Join Study Group</h1>
      <input placeholder="Room ID" value={roomId} onChange={e => setRoomId(e.target.value)} className="border p-2 rounded mr-2"/>
      <button onClick={joinRoom} className="bg-purple-600 text-white p-2 rounded">Join Room</button>

      <div className="mt-4 flex gap-2">
        <input placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} className="border p-2 rounded flex-1"/>
        <button onClick={sendMessage} className="bg-purple-600 text-white p-2 rounded">Send</button>
      </div>

      <div className="mt-4">
        {messages.map((msg, i) => <div key={i} className="p-2 bg-gray-100 rounded mb-1">{msg}</div>)}
      </div>
    </div>
  );
};

export default Groups;