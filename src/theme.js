// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';

import {readdir, noop} from './util.js';

const isDefault = x => x === '' || x === 'Adwaita'; // shell || others
const Gtk3 = ['Adwaita', 'HighContrast', 'HighContrastInverse'];

function getDataDirs(type) {
    return [
        `${GLib.get_home_dir()}/.${type}`,
        `${GLib.get_user_data_dir()}/${type}`,
        ...GLib.get_system_data_dirs().map(dir => `${dir}/${type}`),
    ];
}

export const extant = x => !GLib.access(x, 0); // F_OK == 0

export function getThemeDirs() {
    return getDataDirs('themes');
}

export function getModeThemeDirs() {
    return GLib.get_system_data_dirs().map(dir => `${dir}/gnome-shell/theme`);
}

async function getModeThemes() {
    let files = await Promise.all(getModeThemeDirs().map(async d => await readdir(d, x => x.get_name()).catch(noop) ?? []));
    return files.flat().flatMap(x => x.endsWith('.css') ? [x.slice(0, -4)] : []);
}

async function getThemes(type) {
    return (await Promise.all(getDataDirs(type).map(async d => await readdir(d, x => [d, x.get_name()]).catch(noop) ?? []))).flat();
}

export async function getAllThemes() {
    let modes = await getModeThemes(),
        icons = await getThemes('icons'),
        themes = await getThemes('themes');
    return [
        // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
        themes.map(([x, y]) => extant(`${x}/${y}/gtk-3.0/gtk.css`) ? [y] : []).concat(Gtk3),
        themes.map(([x, y]) => extant(`${x}/${y}/gnome-shell/gnome-shell.css`) ? [y] : []).concat(modes, ''),
        icons.map(([x, y]) => extant(`${x}/${y}/index.theme`) ? [y] : []),
        icons.map(([x, y]) => extant(`${x}/${y}/cursors`) ? [y] : []),
    ].map(x => [...new Set(x.flat())].filter(y => y.toLowerCase() !== 'default' || isDefault(y))
          .sort((a, b) => isDefault(b) - isDefault(a) || a.localeCompare(b))); // => [gtk, shell, icon, cursor]
}
