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

const sgsettings = imports.misc.extensionUtils.getSettings();
const tgsettings = new Gio.Settings({ schema: System.THEMESCHEMA });
const ngsettings = new Gio.Settings({ schema: System.NIGHTSCHEMA });
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
        if(!LightProxy || !ngsettings.get_boolean(System.NIGHTLIGHT))
            return false;
        return LightProxy.NightLightActive;
    }

    _onLightChanged() {
        if(this._isNight) {
            this._sync(tgsettings, System.THEME, sgsettings, Fields.GTKNIGHT);
            this._sync(sgsettings, System.SHELL, sgsettings, Fields.SHELLNIGHT);
            this._sync(tgsettings, System.ICONS, sgsettings, Fields.ICONSNIGHT);
            this._sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSORNIGHT);
        } else {
            this._sync(tgsettings, System.THEME, sgsettings, Fields.GTK);
            this._sync(sgsettings, System.SHELL, sgsettings, Fields.SHELL);
            this._sync(tgsettings, System.ICONS, sgsettings, Fields.ICONS);
            this._sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSOR);
        }
    }

    _sync(scm_a, key_a, scm_b, key_b) {
        if(scm_a.get_string(key_a) != scm_b.get_string(key_b))
            scm_a.set_string(key_a, scm_b.get_string(key_b));
    }

    enable() {
        this._onLightChanged();
        this._proxyChangedId  = LightProxy.connect('g-properties-changed', this._onLightChanged.bind(this));
        this._nightLightOnId  = ngsettings.connect('changed::' + System.NIGHTLIGHT, this._onLightChanged.bind(this));
        this._syncValues();
    }

    _syncValues() { // sync values: 4 sys <=> 8 user
        this._themeChangedId  = tgsettings.connect('changed::' + System.THEME, () => {
            this._sync(sgsettings, this._isNight ? Fields.GTKNIGHT : Fields.GTK, tgsettings, System.THEME);
        });
        this._iconsChangedId  = tgsettings.connect('changed::' + System.ICONS, () => {
            this._sync(sgsettings, this._isNight ? Fields.ICONSNIGHT : Fields.ICONS, tgsettings, System.ICONS);
        });
        this._cursorChangedId = tgsettings.connect('changed::' + System.CURSOR, () => {
            this._sync(sgsettings, this._isNight ? Fields.CURSORNIGHT : Fields.CURSOR, tgsettings, System.CURSOR);
        });
        this._shellChangedID  = sgsettings.connect('changed::' + System.SHELL, () => {
            this._sync(sgsettings, this._isNight ? Fields.SHELLNIGHT : Fields.SHELL, sgsettings, System.SHELL);
        });

        this._gtkID = sgsettings.connect('changed::' + Fields.GTK, () => {
            if(!this._isNight) this._sync(tgsettings, System.THEME, sgsettings, Fields.GTK);
        });
        this._shellID = sgsettings.connect('changed::' + Fields.SHELL, () => {
            if(!this._isNight) this._sync(sgsettings, System.SHELL, sgsettings, Fields.SHELL);
        });
        this._iconsID = sgsettings.connect('changed::' + Fields.ICONS, () => {
            if(!this._isNight) this._sync(tgsettings, System.ICONS, sgsettings, Fields.ICONS);
        });
        this._cursorID = sgsettings.connect('changed::' + Fields.CURSOR, () => {
            if(!this._isNight) this._sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSOR);
        });
        this._gtkNID = sgsettings.connect('changed::' + Fields.GTKNIGHT, () => {
            if(this._isNight) this._sync(tgsettings, System.THEME, sgsettings, Fields.GTKNIGHT);
        });
        this._shellNID = sgsettings.connect('changed::' + Fields.SHELLNIGHT, () => {
            if(this._isNight) this._sync(sgsettings, System.SHELL, sgsettings, Fields.SHELLNIGHT);
        });
        this._iconsNID = sgsettings.connect('changed::' + Fields.ICONSNIGHT, () => {
            if(this._isNight) this._sync(tgsettings, System.ICONS, sgsettings, Fields.ICONSNIGHT);
        });
        this._cursorNID = sgsettings.connect('changed::' + Fields.CURSORNIGHT, () => {
            if(this._isNight) this._sync(tgsettings, System.CURSOR, sgsettings, Fields.CURSORNIGHT);
        });
    }

    disable() {
        if(this._nightLightOnId)
            ngsettings.disconnect(this._nightLightOnId), this._nightLightOnId = 0;
        if(this._themeChangedId)
            tgsettings.disconnect(this._themeChangedId), this._themeChangedId = 0;
        if(this._iconsChangedId)
            tgsettings.disconnect(this._iconsChangedId), this._iconsChangedId = 0;
        if(this._cursorChangedId)
            tgsettings.disconnect(this._cursorChangedId), this._cursorChangedId = 0;
        if(this._proxyChangedId)
            LightProxy.disconnect(this._proxyChangedId), this._proxyChangedId = 0;
        for(let x in this)
            if(RegExp(/^_.+ID$/).test(x)) eval('if(this.%s) sgsettings.disconnect(this.%s), this.%s = 0;'.format(x, x, x));

    }
});

