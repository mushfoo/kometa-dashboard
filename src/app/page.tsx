import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to Kometa Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Manage your Kometa media library automation with ease
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Link
            href="/dashboard"
            className="group rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4 transition-all hover:border-blue-500 hover:shadow-lg hover:dark:border-blue-400"
          >
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
              Dashboard{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View system status and recent operations
            </p>
          </Link>

          <Link
            href="/config"
            className="group rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4 transition-all hover:border-blue-500 hover:shadow-lg hover:dark:border-blue-400"
          >
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
              Configuration{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your Kometa configuration
            </p>
          </Link>

          <Link
            href="/collections"
            className="group rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4 transition-all hover:border-blue-500 hover:shadow-lg hover:dark:border-blue-400"
          >
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
              Collections{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create and manage collections
            </p>
          </Link>

          <Link
            href="/logs"
            className="group rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4 transition-all hover:border-blue-500 hover:shadow-lg hover:dark:border-blue-400"
          >
            <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
              Logs{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Monitor operations and logs
            </p>
          </Link>
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}
