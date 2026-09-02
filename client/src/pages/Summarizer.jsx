import { useState } from "react";

export default function Summarizer() {
  const [file, setFile] = useState(null);

  return (
    /* 1. Main Container: Added dark:bg-gray-800 and dark:border-gray-700 */
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6 border border-transparent dark:border-gray-700 transition-colors">
      
      {/* 2. Header: Added dark:text-white and dark:text-gray-400 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Summarizer</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload lecture audio, video, PDF, or paste text to generate notes.
        </p>
      </div>

      {/* 3. File Upload Box: Added dark:border-gray-600 and dark:hover:border-indigo-400 */}
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-all bg-gray-50/50 dark:bg-gray-900/30">
        <input
          type="file"
          accept=".pdf,.mp3,.wav,.mp4,.mkv"
          className="hidden"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
          Click to upload file
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          PDF, Audio, or Video
        </span>
      </label>

      {file && (
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
          Selected file: {file.name}
        </p>
      )}

      {/* 4. Textarea: Added dark:bg-gray-900, dark:border-gray-700, and dark:text-white */}
      <textarea
        placeholder="Or paste lecture text here..."
        className="w-full h-40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
      />

      <button className="w-full md:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-sm">
        Generate Summary
      </button>

      {/* 5. Output Box: Added dark:bg-gray-900/50 and dark:border-gray-700 */}
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-5 animate-pulse">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI-generated summary will appear here...
        </p>
      </div>
    </div>
  );
}

// export default function Summarizer() {
//   return (
//     <div className="bg-white rounded-xl shadow p-6 space-y-4">
//       <h1 className="text-xl font-semibold">
//         AI Summarizer
//       </h1>

//       <input
//         type="file"
//         className="block w-full text-sm text-gray-600
//         file:mr-4 file:py-2 file:px-4
//         file:rounded-lg file:border-0
//         file:bg-indigo-50 file:text-indigo-600
//         hover:file:bg-indigo-100 transition"
//       />

//       <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
//         Summarize
//       </button>
//     </div>
//   );
// }
