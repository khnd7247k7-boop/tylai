//
// Bridging header for Swift ↔ Obj-C in the TYLAI target.
// Native modules use `import React` in Swift and RCT_EXTERN_* in .m files — no React imports here.
// Importing React in this header triggers a stale RCTDeprecation module-cache fatal error when
// building React Native from source (ios.buildReactNativeFromSource).
