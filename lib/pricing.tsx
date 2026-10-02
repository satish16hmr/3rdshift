import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function becomeFoundingMember(
    router?: AppRouterInstance,
    pathname?: string
) {
    if (pathname === '/pricing') {
        const el = document.getElementById('pricing-plans');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    } else if (router) {
        router.push('/pricing#pricing-plans');
    }
}