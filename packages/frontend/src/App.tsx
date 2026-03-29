import { useUsers } from "@/hooks/use-users";
import { useAuthStore } from "@/stores/auth";

export default function App() {
  const { data: users, isLoading, error } = useUsers();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">BuildPanda</h1>
          {user && (
            <span className="text-sm text-gray-500">
              {user.name}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-6 text-2xl font-semibold">Users</h2>

        {isLoading && (
          <p className="text-gray-500">Loading...</p>
        )}

        {error && (
          <p className="text-red-600">
            Failed to load users.
          </p>
        )}

        {users && (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{u.name}</span>
                <span className="text-sm text-gray-500">{u.email}</span>
              </li>
            ))}
            {users.length === 0 && (
              <li className="px-4 py-6 text-center text-gray-400">
                No users yet.
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
