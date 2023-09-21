// vim:fdm=syntax
// by tuberry
import GLib from 'gi://GLib';

import { fpath, denum, fexist } from './util.js';

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

async function getModeThemes() {
    let files = await Promise.all(getModeThemeDirs().map(dir => denum(dir, x => x.get_name())));
    return files.flat().flatMap(x => x.endsWith('.css') ? [x.slice(0, -4)] : []);
}

async function getThemes(type) {
    return (await Promise.all(getDataDirs(type).map(dir => denum(dir, x => [dir, x.get_name()])))).flat();
}

export async function getAllThemes() {
    let icons = await getThemes('icons'),
        themes = await getThemes('themes'),
        modes = await getModeThemes(),
        ret = await Promise.all([
            // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
            themes.map(async ([x, y]) => await fexist(x, y, 'gtk-3.0', 'gtk.css') ? [y] : []).concat(gtk3_presets),
            themes.map(async ([x, y]) => await fexist(x, y, 'gnome-shell', 'gnome-shell.css') ? [y] : []).concat(modes, 'Default'),
            icons.map(async ([x, y]) => await fexist(x, y, 'icon-theme.cache') ? [y] : []),
            icons.map(async ([x, y]) => await fexist(x, y, 'cursors') ? [y] : []),
        ].map(x => Promise.all(x)));
    return ret.map(x => [...new Set(x.flat())].sort()); // => [gtk, shell, icon, cursor]
}
