type RpcClient = {
  rpc(name: string): PromiseLike<{ data: unknown; error: { message: string } | null } | undefined>;
  auth?: {
    getUser(): PromiseLike<{ data: { user: { id: string } | null } }>;
  };
  from?: (table: string) => {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): PromiseLike<{ data: unknown; error?: { message: string } | null }>;
        maybeSingle(): PromiseLike<{ data: unknown; error?: { message: string } | null }>;
      };
    };
  };
};

export type OwnProfile = {
  id: string;
  nickname: string;
  role: "user" | "operator";
  trust_score: number;
  age_group: string | null;
  interests: string[];
  use_purpose?: string | null;
  preferred_platforms?: string[];
};

export async function getOwnProfile(client: unknown): Promise<OwnProfile | null> {
  const typed = client as RpcClient;
  if (typeof typed.rpc === "function") {
    const result = await typed.rpc("get_own_profile");
    if (result) {
      if (result.error) throw new Error(result.error.message);
      return typeof result.data === "object" && result.data !== null && !Array.isArray(result.data)
        ? result.data as OwnProfile
        : null;
    }
  }
  const user = (await typed.auth?.getUser())?.data.user;
  if (!user || !typed.from) return null;
  const fallback = await typed.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return typeof fallback.data === "object" && fallback.data !== null && !Array.isArray(fallback.data)
    ? fallback.data as OwnProfile
    : null;
}

export async function isOperator(client: unknown): Promise<boolean> {
  const typed = client as RpcClient;
  const user = (await typed.auth?.getUser())?.data.user;
  if (user && typed.from) {
    const legacy = await typed.from("profiles").select("role").eq("id", user.id).single();
    if (typeof legacy.data === "object" && legacy.data !== null && "role" in legacy.data) {
      return legacy.data.role === "operator";
    }
  }
  if (typeof typed.rpc !== "function") return false;
  const result = await typed.rpc("is_operator");
  if (!result) return false;
  if (result.error) throw new Error(result.error.message);
  return result.data === true;
}
