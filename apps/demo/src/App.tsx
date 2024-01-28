import {useEffect} from 'react';
import {MainServiceType} from './service.mjs';
import {worker} from './workerManager.mjs';
import {connect} from 'typed-postmessage-rpc/client';

function MainForm() {
    useEffect(() => {
        (async () => {
            const client = await connect<MainServiceType>({
                on: worker,
            });

            // const result = await client.helloSync.invoke('Omran');
            // console.log(result);

            const dispose = client.randomStream.observe(
                20,
                50,
            )((data) => {
                console.log(Math.round(data));
            });

            setTimeout(() => {
                console.log('client: disposing.');
                dispose();
            }, 5_000);
        })();
    }, []);

    return <div></div>;
}

function App() {
    return <MainForm />;
}

export default App;
