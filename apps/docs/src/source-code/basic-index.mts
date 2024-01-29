const worker = new Worker(new URL('./worker.mts', import.meta.url), {
    type: 'module',
});

// Now you have a worker!
