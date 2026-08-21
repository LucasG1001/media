import { describe, it, expect } from "vitest";
import { proxied } from "./imageUrl";

describe("proxied", () => {
  it("routes an absolute CDN URL through the backend cache", () => {
    expect(proxied("https://image.tmdb.org/t/p/w500/a.jpg")).toBe(
      "/api/img?u=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fa.jpg"
    );
  });

  it("leaves a backend path alone (games already proxy their own images)", () => {
    expect(proxied("/api/game/image/t_cover_big/co1r7f.jpg")).toBe("/api/game/image/t_cover_big/co1r7f.jpg");
  });

  it("passes null and empty through", () => {
    expect(proxied(null)).toBeNull();
    expect(proxied(undefined)).toBeNull();
    expect(proxied("")).toBeNull();
  });

  it("escapes a query string so it stays part of the upstream URL", () => {
    expect(proxied("https://yt3.ggpht.com/a?sz=88")).toBe("/api/img?u=https%3A%2F%2Fyt3.ggpht.com%2Fa%3Fsz%3D88");
  });
});
