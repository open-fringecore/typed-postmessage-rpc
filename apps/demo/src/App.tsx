import {mainService, MainServiceType} from './service.mjs';
import {worker} from './workerManager.mjs';
import {connect} from 'typed-postmessage-rpc/client';
import {serve} from 'typed-postmessage-rpc/server';
import {useEffect, useRef} from 'react';

serve({
    service: mainService,
    on: window,
});

function MainForm() {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        (async () => {
            serve({
                service: mainService,
                on: worker,
            });

            const workerClient = await connect<MainServiceType>({
                on: worker,
            });

            console.log(await workerClient.hello.invoke('worker-parent'));

            const iframeClient = await connect<MainServiceType>({
                on: iframeRef.current!.contentWindow!,
            });

            console.log(await iframeClient.hello.invoke('iframe-parent'));
        })();
    }, []);

    return (
        <div>
            <iframe ref={iframeRef} src={'/?inner'}></iframe>
        </div>
    );
}

function App() {
    return window.location.href.includes('inner') ? (
        <div>iframe</div>
    ) : (
        <MainForm />
    );
}

export default App;
