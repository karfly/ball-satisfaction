import { useRef, useEffect } from "react";
import { Game } from "../engine/Game";

export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const g = new Game();
    g.init(host.current!);
    return () => g.destroy();
  }, []);

  return <div ref={host} style={{ width:"100%", height:"100%" }}/>;
}