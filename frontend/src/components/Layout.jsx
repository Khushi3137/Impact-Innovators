
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

      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
