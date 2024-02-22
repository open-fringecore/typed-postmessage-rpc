import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    integrations: [
        starlight({
            title: 'typed-postmessage-rpc',
            social: {
                github: 'https://github.com/withastro/starlight',
            },
            sidebar: [
                {
                    label: 'Home',
                    link: '/',
                },
                {
                    label: 'Installation',
                    link: '/installation',
                },
                {
                    label: 'Guides',
                    items: [
                        {
                            label: 'Quick Start',
                            link: '/quickstart',
                        },
                    ],
                },
                {
                    label: 'Usage',
                    items: [
                        {
                            label: 'Writing Services',
                            link: '/usage/service',
                        },
                        {
                            label: 'Serving Services',
                            link: '/usage/serve',
                        },
                        {
                            label: 'Clients',
                            link: '/usage/connect',
                        },
                        {
                            label: 'Advanced',
                            items: [
                                {
                                    label: 'Observables',
                                    link: '/usage/advanced/observables',
                                },
                                {
                                    label: 'Multiple Services',
                                    link: '/usage/advanced/multiple-services',
                                },
                                {
                                    label: 'Service + Client',
                                    link: '/usage/advanced/dual-mode',
                                },
                            ],
                        },
                    ],
                },
                {
                    label: 'Contexts',
                    autogenerate: {directory: 'contexts'},
                },
            ],
        }),
    ],
});
