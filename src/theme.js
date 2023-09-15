// vim:fdm=syntax
// by tuberry

import GLib from 'gi://GLib';

import { noop, fpath, fopen, fexist, denum } from './util.js';

const gtk3_presets = ['Adwaita', 'HighContrast', 'HighContrastInverse'];

function getDataDirs(type) {
    return [
        fpath(GLib.get_home_dir(), `.${type}`),
        fpath(GLib.get_user_data_dir(), type),
        ...GLib.get_system_data_dirs().map(dir => fpath(dir, type)),
    ];
}

export function getThemeDirs() {
    return getDataDirs('themes');
}

export function getModeThemeDirs() {
    return GLib.get_system_data_dirs().map(dir => fpath(dir, 'gnome-shell', 'theme'));
}

async function enumerateDirs(dirs) {
    return (await Promise.all(dirs.map(async path =>
        [...await denum(fopen(path)).catch(noop) ?? []].map(x => ({ name: x.get_name(), path }))))).flat();
}

async function getThemes(type) {
    return (await enumerateDirs(getDataDirs(type))).map(({ name, path }) => ({ name, path: `${path}/${name}` }));
}

async function getModeThemes() {
    return (await enumerateDirs(getModeThemeDirs())).flatMap(({ name }) => name.endsWith('.css') ? [name.slice(0, -4)] : []);
}

export async function getAllThemes() {
    let icons = await getThemes('icons'),
        themes = await getThemes('themes'),
        modes = await getModeThemes(),
        ret = await Promise.all([
            // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
            themes.map(async ({ path: x, name: y }) => await fexist(x, 'gtk-3.0', 'gtk.css').catch(noop) ? [y] : []).concat(gtk3_presets),
            themes.map(async ({ path: x, name: y }) => await fexist(x, 'gnome-shell', 'gnome-shell.css').catch(noop) ? [y] : []).concat(modes, 'Default'),
            icons.map(async ({ path: x, name: y }) => await fexist(x, 'icon-theme.cache') ? [y] : []),
            icons.map(async ({ path: x, name: y }) => await fexist(x, 'cursors') ? [y] : []),
        ].map(x => Promise.all(x)));
    return ret.map(x => [...new Set(x.flat())].sort()); // => [gtk, shell, icon, cursor]
}
