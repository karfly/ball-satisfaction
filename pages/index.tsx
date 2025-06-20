import dynamic from "next/dynamic";

const GameCanvas = dynamic(() => import("../components/GameCanvas"), { ssr: false });

export default function Home() {
  return (
    <div className="w-screen h-screen m-0 relative">
      <GameCanvas />
    </div>
  );
}