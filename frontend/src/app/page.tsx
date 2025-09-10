export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          CRM Unifier
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Unified customer correspondence platform
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Customers</h2>
            <p className="text-muted-foreground">
              Manage customer profiles and view unified timelines
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Messages</h2>
            <p className="text-muted-foreground">
              Search and filter messages across all channels
            </p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Providers</h2>
            <p className="text-muted-foreground">
              Configure communication providers and webhooks
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}