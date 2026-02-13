<?php
/**
 * Plugin Name: Brønnøysund + Gravity Forms Autocomplete
 * Description: Autocomplete company info from Brønnøysund by using CSS classes on Gravity Forms fields.
 * Author: Nettsmed AS
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Brreg_GravityForms_Autocomplete {

    const OPTION_NAME = 'brreg_gf_autocomplete_settings';

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
        add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_styles' ) );
        register_activation_hook( __FILE__, array( __CLASS__, 'activate' ) );
    }

    /**
     * Default config for mappings.
     * Now reads from wp_options, with fallback to defaults.
     */
    public static function get_config() {
        $defaults = self::get_default_config();

        // Run migration if needed (converts old global settings to per-field)
        $saved = self::maybe_migrate_settings();

        // Build field_settings from saved or defaults
        $field_keys = array( 'orgnr', 'street', 'zip', 'city', 'email' );
        $field_settings = array();

        foreach ( $field_keys as $key ) {
            $field_settings[ $key ] = array(
                'uneditable' => isset( $saved['field_settings'][ $key ]['uneditable'] )
                    ? (bool) $saved['field_settings'][ $key ]['uneditable']
                    : $defaults['field_settings'][ $key ]['uneditable'],
                'uneditable_after_population' => isset( $saved['field_settings'][ $key ]['uneditable_after_population'] )
                    ? (bool) $saved['field_settings'][ $key ]['uneditable_after_population']
                    : $defaults['field_settings'][ $key ]['uneditable_after_population'],
            );
        }

        // Merge saved settings with defaults
        $config = array(
            'profiles' => array(
                array(
                    'id'             => 'default',
                    'trigger_class'  => isset( $saved['trigger_class'] ) ? $saved['trigger_class'] : $defaults['trigger_class'],
                    'min_chars'      => isset( $saved['min_chars'] ) ? intval( $saved['min_chars'] ) : $defaults['min_chars'],
                    'outputs'        => array(
                        'orgnr'  => ! empty( $saved['outputs']['orgnr'] ) ? $saved['outputs']['orgnr'] : $defaults['outputs']['orgnr'],
                        'street' => ! empty( $saved['outputs']['street'] ) ? $saved['outputs']['street'] : $defaults['outputs']['street'],
                        'zip'    => ! empty( $saved['outputs']['zip'] ) ? $saved['outputs']['zip'] : $defaults['outputs']['zip'],
                        'city'   => ! empty( $saved['outputs']['city'] ) ? $saved['outputs']['city'] : $defaults['outputs']['city'],
                        'email'  => ! empty( $saved['outputs']['email'] ) ? $saved['outputs']['email'] : $defaults['outputs']['email'],
                    ),
                    'field_settings'     => $field_settings,
                    'bypass_field_class' => isset( $saved['bypass_field_class'] ) ? $saved['bypass_field_class'] : $defaults['bypass_field_class'],
                    'bypass_value'       => isset( $saved['bypass_value'] ) ? $saved['bypass_value'] : $defaults['bypass_value'],
                    'conditions'         => array(),
                ),
            ),
        );

        /**
         * Filter so we can override config from theme/other plugin.
         */
        return apply_filters( 'brreg_gf_autocomplete_config', $config );
    }

    /**
     * Get default configuration values.
     */
    private static function get_default_config() {
        return array(
            'trigger_class'  => 'bedrift',
            'min_chars'      => 2,
            'outputs'        => array(
                'orgnr'  => 'org_nummer',
                'street' => 'invoice_street',
                'zip'    => 'invoice_zip',
                'city'   => 'invoice_city',
                'email'  => 'invoice_email',
            ),
            'field_settings' => array(
                'orgnr'  => array( 'uneditable' => false, 'uneditable_after_population' => false ),
                'street' => array( 'uneditable' => false, 'uneditable_after_population' => false ),
                'zip'    => array( 'uneditable' => false, 'uneditable_after_population' => false ),
                'city'   => array( 'uneditable' => false, 'uneditable_after_population' => false ),
                'email'  => array( 'uneditable' => false, 'uneditable_after_population' => false ),
            ),
            'bypass_field_class' => '',
            'bypass_value'       => '',
        );
    }

    /**
     * Migrate old global uneditable settings to new per-field settings.
     * This ensures backward compatibility for existing installations.
     */
    private static function maybe_migrate_settings() {
        $saved = get_option( self::OPTION_NAME, array() );

        // Check if migration is needed: old settings exist but new field_settings doesn't
        $has_old_settings = isset( $saved['make_fields_uneditable'] ) || isset( $saved['make_uneditable_after_population'] );
        $has_new_settings = isset( $saved['field_settings'] );

        if ( $has_old_settings && ! $has_new_settings ) {
            $make_uneditable       = ! empty( $saved['make_fields_uneditable'] );
            $uneditable_after_pop  = ! empty( $saved['make_uneditable_after_population'] );

            // Build per-field settings from old global settings
            $field_keys = array( 'orgnr', 'street', 'zip', 'city', 'email' );
            $field_settings = array();

            foreach ( $field_keys as $key ) {
                $field_settings[ $key ] = array(
                    'uneditable'                 => $make_uneditable,
                    'uneditable_after_population' => $uneditable_after_pop,
                );
            }

            // Save migrated settings
            $saved['field_settings'] = $field_settings;

            // Remove old settings
            unset( $saved['make_fields_uneditable'] );
            unset( $saved['make_uneditable_after_population'] );

            update_option( self::OPTION_NAME, $saved );
        }

        return $saved;
    }

    /**
     * Set default options on plugin activation.
     */
    public static function activate() {
        $defaults = self::get_default_config();
        $current = get_option( self::OPTION_NAME, array() );

        // Only set defaults if no settings exist
        if ( empty( $current ) ) {
            update_option( self::OPTION_NAME, $defaults );
        }
    }

    /**
     * Add admin menu page.
     */
    public function add_admin_menu() {
        add_options_page(
            'Brønnøysund + Gravity Forms',
            'Brreg GF Autocomplete',
            'manage_options',
            'brreg-gf-autocomplete',
            array( $this, 'render_settings_page' )
        );
    }

    /**
     * Register settings.
     */
    public function register_settings() {
        register_setting(
            'brreg_gf_autocomplete_settings_group',
            self::OPTION_NAME,
            array( $this, 'sanitize_settings' )
        );
    }

    /**
     * Sanitize settings before saving.
     */
    public function sanitize_settings( $input ) {
        $sanitized = array();

        if ( isset( $input['trigger_class'] ) ) {
            $sanitized['trigger_class'] = sanitize_html_class( $input['trigger_class'] );
        }

        if ( isset( $input['min_chars'] ) ) {
            $sanitized['min_chars'] = absint( $input['min_chars'] );
        }

        if ( isset( $input['outputs'] ) && is_array( $input['outputs'] ) ) {
            $sanitized['outputs'] = array();
            foreach ( $input['outputs'] as $key => $value ) {
                $sanitized['outputs'][ $key ] = sanitize_html_class( $value );
            }
        }

        // Sanitize per-field settings
        $field_keys = array( 'orgnr', 'street', 'zip', 'city', 'email' );
        $sanitized['field_settings'] = array();

        foreach ( $field_keys as $key ) {
            $sanitized['field_settings'][ $key ] = array(
                'uneditable'                 => isset( $input['field_settings'][ $key ]['uneditable'] ) ? 1 : 0,
                'uneditable_after_population' => isset( $input['field_settings'][ $key ]['uneditable_after_population'] ) ? 1 : 0,
            );
        }

        $sanitized['bypass_field_class'] = isset( $input['bypass_field_class'] ) ? sanitize_html_class( $input['bypass_field_class'] ) : '';
        $sanitized['bypass_value'] = isset( $input['bypass_value'] ) ? sanitize_text_field( $input['bypass_value'] ) : '';

        return $sanitized;
    }

    /**
     * Enqueue admin styles.
     */
    public function enqueue_admin_styles( $hook ) {
        if ( 'settings_page_brreg-gf-autocomplete' !== $hook ) {
            return;
        }

        wp_enqueue_style(
            'brreg-gf-admin',
            plugin_dir_url( __FILE__ ) . 'assets/css/admin.css',
            array(),
            '1.1.0'
        );
    }

    /**
     * Render settings page.
     */
    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        // Run migration if needed (converts old global settings to per-field)
        self::maybe_migrate_settings();

        $defaults = self::get_default_config();
        $saved    = get_option( self::OPTION_NAME, array() );

        // Merge saved settings with defaults to ensure all keys exist
        $settings = array(
            'trigger_class'  => ! empty( $saved['trigger_class'] ) ? $saved['trigger_class'] : $defaults['trigger_class'],
            'min_chars'      => isset( $saved['min_chars'] ) ? $saved['min_chars'] : $defaults['min_chars'],
            'outputs'        => array(
                'orgnr'  => ! empty( $saved['outputs']['orgnr'] ) ? $saved['outputs']['orgnr'] : $defaults['outputs']['orgnr'],
                'street' => ! empty( $saved['outputs']['street'] ) ? $saved['outputs']['street'] : $defaults['outputs']['street'],
                'zip'    => ! empty( $saved['outputs']['zip'] ) ? $saved['outputs']['zip'] : $defaults['outputs']['zip'],
                'city'   => ! empty( $saved['outputs']['city'] ) ? $saved['outputs']['city'] : $defaults['outputs']['city'],
                'email'  => ! empty( $saved['outputs']['email'] ) ? $saved['outputs']['email'] : $defaults['outputs']['email'],
            ),
            'field_settings'     => isset( $saved['field_settings'] ) ? $saved['field_settings'] : $defaults['field_settings'],
            'bypass_field_class' => isset( $saved['bypass_field_class'] ) ? $saved['bypass_field_class'] : $defaults['bypass_field_class'],
            'bypass_value'       => isset( $saved['bypass_value'] ) ? $saved['bypass_value'] : $defaults['bypass_value'],
        );
        ?>
        <div class="wrap brreg-gf-autocomplete-settings">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields( 'brreg_gf_autocomplete_settings_group' );
                ?>
                <table class="form-table" role="presentation">
                    <tbody>
                        <tr>
                            <th scope="row">
                                <label for="trigger_class"><?php esc_html_e( 'Company Name Field CSS Class', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <input 
                                    type="text" 
                                    id="trigger_class" 
                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[trigger_class]" 
                                    value="<?php echo esc_attr( $settings['trigger_class'] ); ?>" 
                                    class="regular-text"
                                    placeholder="bedrift"
                                />
                                <p class="description">
                                    <?php esc_html_e( 'The CSS class name applied to the Gravity Forms field wrapper for the company name input field.', 'brreg-gf-autocomplete' ); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label><?php esc_html_e( 'Output Field CSS Classes', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <fieldset>
                                    <p>
                                        <label for="output_orgnr">
                                            <?php esc_html_e( 'Organization Number:', 'brreg-gf-autocomplete' ); ?>
                                            <input 
                                                type="text" 
                                                id="output_orgnr" 
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][orgnr]" 
                                                value="<?php echo esc_attr( $settings['outputs']['orgnr'] ); ?>" 
                                                class="regular-text"
                                                placeholder="org_nummer"
                                            />
                                        </label>
                                    </p>
                                    <p>
                                        <label for="output_street">
                                            <?php esc_html_e( 'Street Address:', 'brreg-gf-autocomplete' ); ?>
                                            <input 
                                                type="text" 
                                                id="output_street" 
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][street]" 
                                                value="<?php echo esc_attr( $settings['outputs']['street'] ); ?>" 
                                                class="regular-text"
                                                placeholder="invoice_street"
                                            />
                                        </label>
                                    </p>
                                    <p>
                                        <label for="output_zip">
                                            <?php esc_html_e( 'Zip Code:', 'brreg-gf-autocomplete' ); ?>
                                            <input 
                                                type="text" 
                                                id="output_zip" 
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][zip]" 
                                                value="<?php echo esc_attr( $settings['outputs']['zip'] ); ?>" 
                                                class="regular-text"
                                                placeholder="invoice_zip"
                                            />
                                        </label>
                                    </p>
                                    <p>
                                        <label for="output_city">
                                            <?php esc_html_e( 'City:', 'brreg-gf-autocomplete' ); ?>
                                            <input
                                                type="text"
                                                id="output_city"
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][city]"
                                                value="<?php echo esc_attr( $settings['outputs']['city'] ); ?>"
                                                class="regular-text"
                                                placeholder="invoice_city"
                                            />
                                        </label>
                                    </p>
                                    <p>
                                        <label for="output_email">
                                            <?php esc_html_e( 'Invoice Email:', 'brreg-gf-autocomplete' ); ?>
                                            <input
                                                type="text"
                                                id="output_email"
                                                name="<?php echo esc_attr( self::OPTION_NAME ); ?>[outputs][email]"
                                                value="<?php echo esc_attr( $settings['outputs']['email'] ); ?>"
                                                class="regular-text"
                                                placeholder="invoice_email"
                                            />
                                        </label>
                                    </p>
                                    <p class="description">
                                        <?php esc_html_e( 'CSS class names for the output fields that will be populated with company data.', 'brreg-gf-autocomplete' ); ?>
                                    </p>
                                </fieldset>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="min_chars"><?php esc_html_e( 'Minimum Characters', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <input 
                                    type="number" 
                                    id="min_chars" 
                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[min_chars]" 
                                    value="<?php echo esc_attr( $settings['min_chars'] ); ?>" 
                                    min="1"
                                    max="10"
                                    class="small-text"
                                />
                                <p class="description">
                                    <?php esc_html_e( 'Minimum number of characters before triggering the Brønnøysund API search.', 'brreg-gf-autocomplete' ); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <?php esc_html_e( 'Field Settings', 'brreg-gf-autocomplete' ); ?>
                            </th>
                            <td>
                                <?php
                                $field_labels = array(
                                    'orgnr'  => __( 'Organization Number', 'brreg-gf-autocomplete' ),
                                    'street' => __( 'Street Address', 'brreg-gf-autocomplete' ),
                                    'zip'    => __( 'Zip Code', 'brreg-gf-autocomplete' ),
                                    'city'   => __( 'City', 'brreg-gf-autocomplete' ),
                                    'email'  => __( 'Invoice Email', 'brreg-gf-autocomplete' ),
                                );

                                // Ensure field_settings exists with proper structure
                                $field_settings = isset( $settings['field_settings'] ) ? $settings['field_settings'] : array();
                                ?>
                                <table class="brreg-field-settings-table widefat">
                                    <thead>
                                        <tr>
                                            <th><?php esc_html_e( 'Output Field', 'brreg-gf-autocomplete' ); ?></th>
                                            <th><?php esc_html_e( 'CSS Class', 'brreg-gf-autocomplete' ); ?></th>
                                            <th>
                                                <?php esc_html_e( 'Make Uneditable', 'brreg-gf-autocomplete' ); ?>
                                                <br><small><a href="#" class="brreg-select-all" data-column="uneditable"><?php esc_html_e( 'Select All', 'brreg-gf-autocomplete' ); ?></a> | <a href="#" class="brreg-deselect-all" data-column="uneditable"><?php esc_html_e( 'Deselect All', 'brreg-gf-autocomplete' ); ?></a></small>
                                            </th>
                                            <th>
                                                <?php esc_html_e( 'Uneditable After Population', 'brreg-gf-autocomplete' ); ?>
                                                <br><small><a href="#" class="brreg-select-all" data-column="uneditable_after_population"><?php esc_html_e( 'Select All', 'brreg-gf-autocomplete' ); ?></a> | <a href="#" class="brreg-deselect-all" data-column="uneditable_after_population"><?php esc_html_e( 'Deselect All', 'brreg-gf-autocomplete' ); ?></a></small>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ( $field_labels as $key => $label ) :
                                            $css_class = isset( $settings['outputs'][ $key ] ) ? $settings['outputs'][ $key ] : '';
                                            $is_uneditable = ! empty( $field_settings[ $key ]['uneditable'] );
                                            $is_uneditable_after = ! empty( $field_settings[ $key ]['uneditable_after_population'] );
                                        ?>
                                        <tr>
                                            <td><strong><?php echo esc_html( $label ); ?></strong></td>
                                            <td><code><?php echo esc_html( $css_class ); ?></code></td>
                                            <td class="checkbox-cell">
                                                <input
                                                    type="checkbox"
                                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[field_settings][<?php echo esc_attr( $key ); ?>][uneditable]"
                                                    value="1"
                                                    data-column="uneditable"
                                                    <?php checked( $is_uneditable ); ?>
                                                />
                                            </td>
                                            <td class="checkbox-cell">
                                                <input
                                                    type="checkbox"
                                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[field_settings][<?php echo esc_attr( $key ); ?>][uneditable_after_population]"
                                                    value="1"
                                                    data-column="uneditable_after_population"
                                                    <?php checked( $is_uneditable_after ); ?>
                                                />
                                            </td>
                                        </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                                <p class="description">
                                    <?php esc_html_e( 'Configure which fields should be made uneditable (read-only). Check "Make Uneditable" to enable locking for a field. By default, fields are locked at page load. Additionally check "Uneditable After Population" to delay locking until a company is selected (fields unlock when cleared).', 'brreg-gf-autocomplete' ); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="bypass_field_class"><?php esc_html_e( 'Bypass Field CSS Class', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <input
                                    type="text"
                                    id="bypass_field_class"
                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[bypass_field_class]"
                                    value="<?php echo esc_attr( $settings['bypass_field_class'] ); ?>"
                                    class="regular-text"
                                    placeholder="privat_betaling"
                                />
                                <p class="description">
                                    <?php esc_html_e( 'CSS class of a radio/select/checkbox field that switches to "org-only" mode (e.g. "Betaler du privat?"). When active, only org number is populated from Brønnøysund — address fields stay editable for manual entry.', 'brreg-gf-autocomplete' ); ?>
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="bypass_value"><?php esc_html_e( 'Bypass Value', 'brreg-gf-autocomplete' ); ?></label>
                            </th>
                            <td>
                                <input
                                    type="text"
                                    id="bypass_value"
                                    name="<?php echo esc_attr( self::OPTION_NAME ); ?>[bypass_value]"
                                    value="<?php echo esc_attr( $settings['bypass_value'] ); ?>"
                                    class="regular-text"
                                    placeholder="Ja"
                                />
                                <p class="description">
                                    <?php esc_html_e( 'When the bypass field has this value, only org number is populated. Address fields remain editable for the user to fill in manually.', 'brreg-gf-autocomplete' ); ?>
                                </p>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <script>
        (function() {
            document.addEventListener('DOMContentLoaded', function() {
                // Select All links
                document.querySelectorAll('.brreg-select-all').forEach(function(link) {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        var column = this.getAttribute('data-column');
                        document.querySelectorAll('input[data-column="' + column + '"]').forEach(function(checkbox) {
                            checkbox.checked = true;
                        });
                    });
                });

                // Deselect All links
                document.querySelectorAll('.brreg-deselect-all').forEach(function(link) {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        var column = this.getAttribute('data-column');
                        document.querySelectorAll('input[data-column="' + column + '"]').forEach(function(checkbox) {
                            checkbox.checked = false;
                        });
                    });
                });
            });
        })();
        </script>
        <?php
    }

    public function enqueue_scripts() {
        // Only load on frontend
        if ( is_admin() ) {
            return;
        }

        // Optional: only load on pages where Gravity Forms is rendered
        // If Gravity Forms not active, bail out
        if ( ! class_exists( 'GFForms' ) ) {
            return;
        }

        // You can add your own conditions here if you want to restrict further
        // e.g. only on arrangement CPT:
        // if ( ! is_singular( 'arrangement' ) ) return;

        $handle = 'brreg-gf-autocomplete';

        // Enqueue frontend styles
        wp_enqueue_style(
            'brreg-gf-frontend',
            plugin_dir_url( __FILE__ ) . 'assets/css/frontend.css',
            array(),
            '1.1.0'
        );

        wp_enqueue_script(
            $handle,
            plugin_dir_url( __FILE__ ) . 'assets/js/brreg-gf-autocomplete.js',
            array(), // no dependencies
            '1.1.0',
            true
        );

        wp_localize_script(
            $handle,
            'BrregGFConfig',
            self::get_config()
        );
    }
}

new Brreg_GravityForms_Autocomplete();

