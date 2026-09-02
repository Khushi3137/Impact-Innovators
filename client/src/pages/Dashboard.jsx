import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";

const data = [
  { date: "Mon", hours: 1 },
  { date: "Tue", hours: 2 },
  { date: "Wed", hours: 1.5 },
  { date: "Thu", hours: 3 },
  { date: "Fri", hours: 2.5 },
];

export default function Dashboard() {
  const { dark } = useContext(ThemeContext);

  // Dynamic colors for the Chart components
  const axisColor = dark ? "#9ca3af" : "#4b5563"; // gray-400 : gray-600
  const gridColor = dark ? "#374151" : "#e5e7eb"; // gray-700 : gray-200
  const tooltipBg = dark ? "#1f2937" : "#ffffff"; // gray-800 : white
  const tooltipText = dark ? "#f3f4f6" : "#111827"; // gray-100 : gray-900

  return (
    <div className="space-y-6 p-4">
      {/* Header - Fixed text visibility */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 transition-colors">
          Track your study progress and performance
        </p>
      </div>

      {/* Stats Cards - Added dark backgrounds and borders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Study Hours" value="10.5 hrs" />
        <StatCard title="Flashcards Reviewed" value="120" />
        <StatCard title="Active Streak" value="4 days" />
      </div>

      {/* Chart Container - Added dark background and dynamic text colors */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        <h2 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
          Weekly Study Time
        </h2>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke={axisColor} 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke={axisColor} 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: tooltipBg, 
                  borderColor: gridColor,
                  borderRadius: '8px',
                  color: tooltipText 
                }} 
                itemStyle={{ color: tooltipText }}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 6, fill: "#6366f1", strokeWidth: 2, stroke: dark ? "#1f2937" : "#fff" }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ---------- Reusable StatCard Component ---------- */
function StatCard({ title, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

// const data = [
//   { date: "Mon", hours: 1 },
//   { date: "Tue", hours: 2 },
//   { date: "Wed", hours: 1.5 },
//   { date: "Thu", hours: 3 },
//   { date: "Fri", hours: 2.5 },
// ];

// export default function Dashboard() {
//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div>
//         <h1 className="text-2xl font-semibold">Dashboard</h1>
//         <p className="text-gray-600">
//           Track your study progress and performance
//         </p>
//       </div>

//       {/* Stats Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//         <StatCard title="Study Hours" value="10.5 hrs" />
//         <StatCard title="Flashcards Reviewed" value="120" />
//         <StatCard title="Active Streak" value="4 days" />
//       </div>

//       {/* Chart */}
//       <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
//         <h2 className="text-lg font-medium mb-4">Weekly Study Time</h2>

//         <ResponsiveContainer width="100%" height={300}>
//           <LineChart data={data}>
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="date" />
//             <YAxis />
//             <Tooltip />
//             <Line
//               type="monotone"
//               dataKey="hours"
//               stroke="#6366f1"
//               strokeWidth={3}
//               dot={{ r: 4 }}
//             />
//           </LineChart>
//         </ResponsiveContainer>
//       </div>
//     </div>
//   );
// }

// /* ---------- Reusable Card ---------- */
// function StatCard({ title, value }) {
//   return (
//     <div className="bg-white rounded-xl shadow-sm p-4">
//       <p className="text-sm text-gray-500">{title}</p>
//       <p className="text-2xl font-semibold mt-1">{value}</p>
//     </div>
//   );
// }
// export default function Dashboard() {
//   return (
//     <div className="bg-white rounded-xl shadow p-6">
//       <h1 className="text-2xl font-semibold mb-2">
//         Dashboard
//       </h1>
//       <p className="text-gray-600">
//         Welcome to your student assistant dashboard.
//       </p>
//     </div>
//   );
// }
