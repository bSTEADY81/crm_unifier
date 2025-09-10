export function requireUuidParam(name: string) {
  const rx = /^[0-9a-f-]{10,}$/i;
  return (req: any, res: any, next: any) => {
    const v = String(req.params?.[name] ?? "").trim();
    if (!v || v === "null" || v === "undefined" || !rx.test(v)) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ field: name, message: "valid UUID" }],
      });
    }
    next();
  };
}