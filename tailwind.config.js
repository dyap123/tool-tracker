/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "surface-tint":"#ffb690","on-primary-container":"#582200","surface-container-high":"#1f2a3c",
        "on-error":"#690005","tertiary-container":"#00a2f4","outline-variant":"#584237",
        "on-secondary-container":"#a9bad3","on-secondary-fixed-variant":"#38485d","primary-container":"#f97316",
        "surface-container":"#152031","on-tertiary-container":"#003554","primary":"#ffb690",
        "surface-variant":"#2a3548","on-surface":"#d8e3fb","surface-container-low":"#111c2d",
        "secondary-fixed-dim":"#b7c8e1","inverse-on-surface":"#263143","on-tertiary-fixed":"#001d32",
        "on-surface-variant":"#e0c0b1","surface-container-lowest":"#040e1f","secondary-fixed":"#d3e4fe",
        "outline":"#a78b7d","secondary-container":"#3a4a5f","primary-fixed":"#ffdbca","on-primary-fixed":"#341100",
        "on-primary-fixed-variant":"#783200","background":"#081425","on-tertiary":"#003351",
        "tertiary-fixed-dim":"#93ccff","on-secondary-fixed":"#0b1c30","on-tertiary-fixed-variant":"#004b74",
        "inverse-surface":"#d8e3fb","on-background":"#d8e3fb","tertiary":"#93ccff","on-error-container":"#ffdad6",
        "inverse-primary":"#9d4300","surface":"#081425","surface-bright":"#2f3a4c","error":"#ffb4ab",
        "error-container":"#93000a","secondary":"#b7c8e1","on-primary":"#552100","surface-dim":"#081425",
        "surface-container-highest":"#2a3548","primary-fixed-dim":"#ffb690","on-secondary":"#213145","tertiary-fixed":"#cde5ff"
      },
      borderRadius:{ "sm":"0.25rem","DEFAULT":"0.5rem","md":"0.75rem","lg":"1rem","xl":"1.5rem","full":"9999px" },
      spacing:{ "base":"4px","xl":"32px","margin-mobile":"16px","sm":"8px","xs":"4px","margin-desktop":"32px","gutter":"16px","lg":"24px","md":"16px" },
      fontFamily:{ "headline-md":["Inter"],"headline-lg":["Inter"],"label-md":["Inter"],"body-md":["Inter"],"label-sm":["Inter"],"label-sm-mobile":["Inter"],"headline-xl-mobile":["Inter"],"body-sm":["Inter"],"headline-xl":["Inter"],"body-lg":["Inter"],"mono":["JetBrains Mono","monospace"] },
      fontSize:{
        "headline-md":["20px",{"lineHeight":"28px","fontWeight":"600"}],
        "headline-lg":["24px",{"lineHeight":"32px","fontWeight":"600"}],
        "label-md":["12px",{"lineHeight":"16px","letterSpacing":"0.05em","fontWeight":"700"}],
        "body-md":["14px",{"lineHeight":"20px","fontWeight":"400"}],
        "label-sm":["10px",{"lineHeight":"12px","fontWeight":"700"}],
        "label-sm-mobile":["10px",{"lineHeight":"12px","fontWeight":"700"}],
        "headline-xl-mobile":["28px",{"lineHeight":"34px","letterSpacing":"-0.01em","fontWeight":"700"}],
        "body-sm":["12px",{"lineHeight":"16px","fontWeight":"400"}],
        "headline-xl":["36px",{"lineHeight":"44px","letterSpacing":"-0.02em","fontWeight":"700"}],
        "body-lg":["16px",{"lineHeight":"24px","fontWeight":"400"}]
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
