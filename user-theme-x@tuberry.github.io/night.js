// vim:fdm=syntax
// by tuberry@github

const { Gio, GObject } = imports.gi;
const Main = imports.ui.main;

var Fields = {
    SHELL:        'name',
    THEME:        'gtk-theme',
    ICONS:        'icon-theme',
    NIGHTLIGHT:   'night-light-enabled',
    THEMESCHEMA:  'org.gnome.desktop.interface',
    NIGHTSCHEMA:  'org.gnome.settings-daemon.plugins.color',
};

const tgsetting = new Gio.Settings({ schema: Fields.THEMESCHEMA });
const ngsetting = new Gio.Settings({ schema: Fields.NIGHTSCHEMA });
const sgsetting = imports.misc.extensionUtils.getSettings();

var Tweaks = {
    _icons:       'icons',
    _theme:       'theme',
    _icons_night: 'icons-night',
    _theme_night: 'theme-night',
};

const NightThemeSwitch = GObject.registerClass(
class NightThemeSwitch extends GObject.Object {
    _init() {
        super._init();
        this._icons = [];
        this._icons_night = [];
        this._theme = [];
        this._theme_night = [];
    }

    _onNightLightChanged() {
        if(ngsetting.get_boolean(Fields.NIGHTLIGHT)) {
            let theme = this._theme.indexOf(tgsetting.get_string(Fields.THEME));
            if(theme > -1 && this._theme_night[theme]) tgsetting.set_string(Fields.THEME, this._theme_night[theme]);
            let icons = this._icons.indexOf(tgsetting.get_string(Fields.ICONS));
            if(icons > -1 && this._icons_night[icons]) tgsetting.set_string(Fields.ICONS, this._icons_night[icons]);
            let shell = sgsetting.get_string(Fields.SHELL);
            if(shell && theme > -1 && this._theme_night[theme]) sgsetting.set_string(Fields.SHELL, this._theme_night[theme]);
        } else {
            let theme = this._theme_night.indexOf(tgsetting.get_string(Fields.THEME));
            if(theme > -1 && this._theme[theme]) tgsetting.set_string(Fields.THEME, this._theme[theme]);
            let icons = this._icons_night.indexOf(tgsetting.get_string(Fields.ICONS));
            if(icons > -1 && this._icons[icons]) tgsetting.set_string(Fields.ICONS, this._icons[icons]);
            let shell = sgsetting.get_string(Fields.SHELL);
            if(shell && theme > -1 && this._theme[theme]) sgsetting.set_string(Fields.SHELL, this._theme[theme]);
        }
    }

    _loadSettings() {
        for(let x in Tweaks)
            eval(`this.%s = sgsetting.get_string('%s') ? sgsetting.get_string('%s').split('#') : []`.format(x, Tweaks[x], Tweaks[x]));
        this._onNightLightChanged();
    }

    enable() {
        this._loadSettings();
        this._nightId = ngsetting.connect(`changed::${Fields.NIGHTLIGHT}`, this._onNightLightChanged.bind(this));
        for(let x in Tweaks)
            eval(`this.%sId = sgsetting.connect('changed::%s', () => { this.%s = sgsetting.get_string('%s') ? sgsetting.get_string('%s').split('#') : [];});`.format(x, Tweaks[x], x, Tweaks[x], Tweaks[x]));
        this._themeChangedId = tgsetting.connect(`changed::${Fields.THEME}`, this._onNightLightChanged.bind(this));
    }

    disable() {
        if(this._nightId)
            ngsetting.disconnect(this._nightId), this._nightId = 0;
        if(this._themeChangedId)
            tgsetting.disconnect(this._themeChangedId), this._themeChangedId = 0;
        for(let x in Tweaks) {
            eval(`if(this.%sId) sgsetting.disconnect(this.%sId), this.%sId = 0;`.format(x, x, x));
            eval(`this.%s = null`.format(x));
        }
    }
});

