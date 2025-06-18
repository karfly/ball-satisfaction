import dynamic from "next/dynamic";

const GameCanvas = dynamic(() => import("../components/GameCanvas"), { ssr: false });

export default function Home() {
  return (
    <div style={{width:"100vw", height:"100vh", margin:0}}>
      <GameCanvas />
    </div>
  );
}