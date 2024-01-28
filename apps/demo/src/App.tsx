import {useEffect} from 'react';
import {MainServiceType} from './service.mjs';
import {worker} from './workerManager.mjs';
import {connect} from 'typed-postmessage-rpc';

function MainForm() {
    useEffect(() => {
        (async () => {
            const client = await connect<MainServiceType>({
                on: worker,
            });

            const result = await client.helloSync.invoke('Omran');
            console.log(result);
        })();
    }, []);

    return <div></div>;
}

function App() {
    return <MainForm />;
}

export default App;
