
// export default function Layout({ children }) {
//   return (
//     <div className="min-h-screen bg-gray-100">
//       <main className="max-w-7xl mx-auto p-6">
//         {children}
//       </main>
//     </div>
//   );
// }
import { Outlet } from "react-router-dom";

function Layout({ children }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar can go here later */}

      <div className="flex-1 flex flex-col">
        {children}
        <main className="p-6 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
