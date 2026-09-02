// import { useState, useEffect } from "react";
// import { socket } from "../sockets/socket";

// const StudySession = () => {
//   const [roomId, setRoomId] = useState("");
//   const [message, setMessage] = useState("");
//   const [messages, setMessages] = useState([]);

//   useEffect(() => {
//     socket.on("session-updated", (data) => setMessages((prev) => [...prev, data]));
//     return () => socket.off("session-updated");
//   }, []);

//   const joinRoom = () => {
//     if (roomId) socket.emit("join-study-room", roomId);
//   };

//   const sendMessage = () => {
//     socket.emit("study-session-update", { roomId, sessionData: message });
//     setMessage("");
//   };

//   return (
//     <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow">
//       <h1 className="text-3xl mb-4">Study Session</h1>
//       <input placeholder="Room ID" value={roomId} onChange={e => setRoomId(e.target.value)} className="border p-2 rounded mr-2"/>
//       <button onClick={joinRoom} className="bg-purple-600 text-white p-2 rounded">Join Room</button>

//       <div className="mt-4 flex gap-2">
//         <input placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} className="border p-2 rounded flex-1"/>
//         <button onClick={sendMessage} className="bg-purple-600 text-white p-2 rounded">Send</button>
//       </div>

//       <div className="mt-4">
//         {messages.map((msg, i) => <div key={i} className="p-2 bg-gray-100 rounded mb-1">{msg}</div>)}
//       </div>
//     </div>
//   );
// };

// export default StudySession;
import { useState } from "react";

export default function StudySession() {
  const [time, setTime] = useState(25);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 text-center space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Study Session</h1>

      <div className="text-6xl font-bold text-indigo-600">
        {time}:00
      </div>

      <div className="flex justify-center gap-4">
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
          Start
        </button>
        <button className="px-4 py-2 bg-gray-200 rounded-lg">
          Reset
        </button>
      </div>

      <p className="text-gray-500">
        Focus for 25 minutes. Stay distraction-free 📚
      </p>
    </div>
  );
}
