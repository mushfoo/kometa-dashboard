export default function DashboardPage() {
  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <p className="text-gray-600 dark:text-gray-400">
            System status information will be displayed here.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Operations</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Recent operations will be listed here.
          </p>
        </div>
      </div>
    </>
  );
}
