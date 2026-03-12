


export function createPageUrl(pageName: string) {
    return '/admin/' + pageName.toLowerCase().replace(/ /g, '-');
}