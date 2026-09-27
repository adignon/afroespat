import preset from '@app/config/tailwind';

/** Sert au Storybook et aux tests ; les applications ont leur propre config. */
export default { presets: [preset], content: ['./src/**/*.{ts,tsx}'] };
