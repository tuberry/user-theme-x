// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';

import * as T from './util.js';

const getModeThemeDirs = () => GLib.get_system_data_dirs().map(d => `${d}/gnome-shell/theme`);
const getDataDirs = x => [`${GLib.get_home_dir()}/.${x}`, ...[GLib.get_user_data_dir()].concat(GLib.get_system_data_dirs()).map(d => `${d}/${x}`)];
const getThemes = async x => (await Promise.all(getDataDirs(x).map(async d => await T.readdir(d, y => [d, y.get_name()]).catch(T.nop) ?? []))).flat();
const getModeThemes = async () => (await Promise.all(getModeThemeDirs().map(async d => await T.readdir(d, x => x.get_name()).catch(T.nop) ?? []))).flat()
    .flatMap(x => x.endsWith('.css') ? [x.slice(0, -4)] : []);

export const getShellThemePath = t => getDataDirs('themes').map(x => `${x}/${t}/gnome-shell/gnome-shell.css`)
    .concat(getModeThemeDirs().map(x => `${x}/${t}.css`)).find(x => T.exist(x));

export async function getAllThemes() {
    let modes = await getModeThemes(),
        icons = await getThemes('icons'),
        themes = await getThemes('themes'),
        [gtk, shell, icon, cursor] = [ // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
            themes.map(([x, y]) => T.exist(`${x}/${y}/gtk-3.0/gtk.css`) ? [y] : []).concat('Adwaita', 'HighContrast', 'HighContrastInverse'),
            themes.map(([x, y]) => T.exist(`${x}/${y}/gnome-shell/gnome-shell.css`) ? [y] : []).concat(modes, ''),
            icons.map(([x, y]) => T.exist(`${x}/${y}/index.theme`) ? [y] : []),
            icons.map(([x, y]) => T.exist(`${x}/${y}/cursors`) ? [y] : []),
        ].map(x => [...new Set(x.flat())].filter(y => y.toLowerCase() !== 'default').sort((a, b) => a.localeCompare(b)));
    return {gtk, shell, icon, cursor};
}
