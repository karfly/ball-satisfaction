import Head from "next/head";
import dynamic from "next/dynamic";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

export default function Home() {
    return (
        <>
            <Head>
                <title>Ball Satisfaction - Physics Simulation</title>
                <meta name="description" content="A simple physics ball simulation game using Phaser 3 Matter.js physics." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.png" />
            </Head>
            <main>
                <AppWithoutSSR />
            </main>
        </>
    );
}
