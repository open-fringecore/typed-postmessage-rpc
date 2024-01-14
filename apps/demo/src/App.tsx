import {useEffect} from 'react';
import {consumer} from 'typed-postmessage-rpc';
import {MainServiceType} from './service.mjs';
import {worker} from './workerManager.mjs';

function MainForm() {
    useEffect(() => {
        const mainClient = consumer<MainServiceType>().connect({
            sendOn: worker,
            receiveOn: worker,
        });

        // console.log(mainClient);

        mainClient.hello('Omran').then((result) => {
            console.log(result);
        });
    }, []);

    return <div></div>;
}

function App() {
    return <MainForm />;
}

export default App;
