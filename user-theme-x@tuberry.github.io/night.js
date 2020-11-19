// vim:fdm=syntax
// by tuberry@github

const Main = imports.ui.main;
const { Gio, GObject } = imports.gi;
const LightProxy = Main.panel.statusArea['aggregateMenu']._nightLight._proxy;

const System = {
    SHELL:        'name',
    THEME:        'gtk-theme',
    ICONS:        'icon-theme',
    CURSOR:       'cursor-theme',
    NIGHTLIGHT:   'night-light-enabled',
    THEMESCHEMA:  'org.gnome.desktop.interface',
    NIGHTSCHEMA:  'org.gnome.settings-daemon.plugins.color',
};

const sgsetting = imports.misc.extensionUtils.getSettings();
const tgsetting = new Gio.Settings({ schema: System.THEMESCHEMA });
const ngsetting = new Gio.Settings({ schema: System.NIGHTSCHEMA });
const Type = { theme: 0, icons: 1, cursor: 2 };

const Fields = {
    GTK:         'gtk-x',
    ICONS:       'icons-x',
    SHELL:       'shell-x',
    CURSOR:      'cursor-x',
    GTKNIGHT:    'gtk-night-x',
    ICONSNIGHT:  'icons-night-x',
    SHELLNIGHT:  'shell-night-x',
    CURSORNIGHT: 'cursor-night-x',
};

var NightThemeSwitch = GObject.registerClass(
class NightThemeSwitch extends GObject.Object {
    _init() {
        super._init();
    }

    get _isNight() {
        if(!LightProxy || !ngsetting.get_boolean(System.NIGHTLIGHT))
            return false;
        return LightProxy.NightLightActive;
    }

    _onLightChanged() {
        if(this._isNight) {
            tgsetting.set_string(System.THEME, sgsetting.get_string(Fields.GTKNIGHT));
            sgsetting.set_string(System.SHELL, sgsetting.get_string(Fields.SHELLNIGHT));
            tgsetting.set_string(System.ICONS, sgsetting.get_string(Fields.ICONSNIGHT));
            tgsetting.set_string(System.CURSOR, sgsetting.get_string(Fields.CURSORNIGHT));
        } else {
            tgsetting.set_string(System.THEME, sgsetting.get_string(Fields.GTK));
            sgsetting.set_string(System.SHELL, sgsetting.get_string(Fields.SHELL));
            tgsetting.set_string(System.ICONS, sgsetting.get_string(Fields.ICONS));
            tgsetting.set_string(System.CURSOR, sgsetting.get_string(Fields.CURSOR));
        }
    }

    enable() {
        this._onLightChanged();
        this._proxyChangedId  = LightProxy.connect('g-properties-changed', this._onLightChanged.bind(this));
        this._nightLightOnId  = ngsetting.connect('changed::' + System.NIGHTLIGHT, this._onLightChanged.bind(this));

        this._eww();
    }

    _eww() { // sync values: 4 sys <=> 8 user
        this._shellChangedId  = sgsetting.connect('changed::' + System.SHELL, () => {
            let key = this._isNight ? Fields.SHELLNIGHT : Fields.SHELL;
            if(sgsetting.get_string(key) != sgsetting.get_string(System.SHELL))
                sgsetting.set_string(key, sgsetting.get_string(System.SHELL));
        });
        this._themeChangedId  = tgsetting.connect('changed::' + System.THEME, () => {
            let key = this._isNight ? Fields.GTKNIGHT : Fields.GTK;
            if(sgsetting.get_string(key) != tgsetting.get_string(System.THEME))
                sgsetting.set_string(key, tgsetting.get_string(System.THEME));
        });
        this._iconsChangedId  = tgsetting.connect('changed::' + System.ICONS, () => {
            let key = this._isNight ? Fields.ICONSNIGHT : Fields.ICONS;
            if(sgsetting.get_string(key) != tgsetting.get_string(System.ICONS))
                sgsetting.set_string(key, tgsetting.get_string(System.ICONS));
        });
        this._cursorChangedId = tgsetting.connect('changed::' + System.CURSOR, () => {
            let key = this._isNight ? Fields.CURSORNIGHT : Fields.CURSOR;
            if(sgsetting.get_string(key) != tgsetting.get_string(System.CURSOR))
                sgsetting.set_string(key, tgsetting.get_string(System.CURSOR));
        });

        this._gtkID = sgsetting.connect('changed::' + Fields.GTK, () => {
            if(this._isNight) return;
            if(tgsetting.get_string(System.THEME) != sgsetting.get_string(Fields.GTK))
                tgsetting.set_string(System.THEME, sgsetting.get_string(Fields.GTK));
        });
        this._shellID = sgsetting.connect('changed::' + Fields.SHELL, () => {
            if(this._isNight) return;
            if(sgsetting.get_string(System.SHELL) != sgsetting.get_string(Fields.SHELL))
                sgsetting.set_string(System.SHELL, sgsetting.get_string(Fields.SHELL))
        });
        this._iconsID = sgsetting.connect('changed::' + Fields.ICONS, () => {
            if(this._isNight) return;
            if(tgsetting.get_string(System.ICONS) != sgsetting.get_string(Fields.ICONS))
                tgsetting.set_string(System.ICONS, sgsetting.get_string(Fields.ICONS))
        });
        this._cursorID = sgsetting.connect('changed::' + Fields.CURSOR, () => {
            if(this._isNight) return;
            if(tgsetting.get_string(System.CURSOR) != sgsetting.get_string(Fields.CURSOR))
                tgsetting.set_string(System.CURSOR, sgsetting.get_string(Fields.CURSOR))
        });
        this._gtkNID = sgsetting.connect('changed::' + Fields.GTKNIGHT, () => {
            if(!this._isNight) return;
            if(tgsetting.get_string(System.THEME) != sgsetting.get_string(Fields.GTKNIGHT))
                tgsetting.set_string(System.THEME, sgsetting.get_string(Fields.GTKNIGHT));
        });
        this._shellNID = sgsetting.connect('changed::' + Fields.SHELLNIGHT, () => {
            if(!this._isNight) return;
            if(sgsetting.get_string(System.SHELL) != sgsetting.get_string(Fields.SHELLNIGHT))
                sgsetting.set_string(System.SHELL, sgsetting.get_string(Fields.SHELLNIGHT));
        });
        this._iconsNID = sgsetting.connect('changed::' + Fields.ICONSNIGHT, () => {
            if(!this._isNight) return;
            if(tgsetting.get_string(System.ICONS) != sgsetting.get_string(Fields.ICONSNIGHT))
                tgsetting.set_string(System.ICONS, sgsetting.get_string(Fields.ICONSNIGHT));
        });
        this._cursorNID = sgsetting.connect('changed::' + Fields.CURSORNIGHT, () => {
            if(!this._isNight) return;
            if(tgsetting.get_string(System.CURSOR) != sgsetting.get_string(Fields.CURSORNIGHT))
                tgsetting.set_string(System.CURSOR, sgsetting.get_string(Fields.CURSORNIGHT));
        });
    }

    disable() {
        if(this._nightLightOnId)
            ngsetting.disconnect(this._nightLightOnId), this._nightLightOnId = 0;
        if(this._themeChangedId)
            tgsetting.disconnect(this._themeChangedId), this._themeChangedId = 0;
        if(this._iconsChangedId)
            tgsetting.disconnect(this._iconsChangedId), this._iconsChangedId = 0;
        if(this._cursorChangedId)
            tgsetting.disconnect(this._cursorChangedId), this._cursorChangedId = 0;
        if(this._proxyChangedId)
            LightProxy.disconnect(this._proxyChangedId), this._proxyChangedId = 0;
        for(let x in this)
            if(RegExp(/^_.+ID$/).test(x)) eval('if(this.%s) sgsettings.disconnect(this.%s), this.%s = 0;'.format(x, x, x));

    }
});

