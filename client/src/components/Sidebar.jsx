export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-100 h-screen p-4">
      <ul className="space-y-2">
        <li className="hover:bg-gray-200 p-2 rounded">Upload Lecture</li>
        <li className="hover:bg-gray-200 p-2 rounded">Summarize Notes</li>
        <li className="hover:bg-gray-200 p-2 rounded">Generate Flashcards</li>
        <li className="hover:bg-gray-200 p-2 rounded">Start Study Session</li>
      </ul>
    </aside>
  );
}
