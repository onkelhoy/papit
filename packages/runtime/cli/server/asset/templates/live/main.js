window.addEventListener("load", function () {

    const ws = new WebSocket('ws://localhost:' + location.port ?? window.PAPIT_PORT);
    ws.onerror = (error) => {
        console.error('live-server socket error:', error);
    }
    ws.onopen = () => {
        console.log('live-server socket connected', 'ws://localhost:' + location.port ?? window.PAPIT_PORT);
    }
    ws.onmessage = (message) => {
        const data = JSON.parse(message.data); // { action: 'update', filename, content }

        switch (data.action)
        {
            case "update":
                // NOTE: this might need to be expanded since this wont upgrade whenever 
                if (window.location.pathname.startsWith(data.filename) || data.filename.startsWith(window.location.pathname))
                    window.location.reload();
                else
                    console.log("hot reload skipped", { filename: data.filename, window: window.location.pathname })
                break;
            case "error":
                console.log('wonk wonk an error..');
                window.currentliveservererrorfile = data.filename;
                window.liveservererrorpopup.querySelector('div.content').innerHTML = data.error.map(error => `<p>${error}</p>`).join('');
                window.liveservererrorpopup.showModal();
                break;
            default:
                console.log('incomming message from server', data, message);
                break;
        }
    }

    window.currentliveservererrorfile = null;
});