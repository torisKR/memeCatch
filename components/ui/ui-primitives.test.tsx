import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

describe("shadcn product primitives", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toContain("px-4");
    expect(cn("px-2", "px-4")).not.toContain("px-2");
  });

  it("renders semantic, composable shop primitives", () => {
    const html = renderToStaticMarkup(
      <Card><CardContent><Badge>Ad</Badge><Alert><AlertTitle>Notice</AlertTitle><AlertDescription>Terms</AlertDescription></Alert><Button>Open</Button></CardContent></Card>,
    );
    expect(html).toContain("Notice");
    expect(html).toContain("Terms");
    expect(html).toContain("type=\"button\"");
  });
});
