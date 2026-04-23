import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@tylertech/forge/dist/forge-core.css'
import '@tylertech/forge/dist/forge.css'
import {
  defineIconComponent,
  defineAppBarComponent,
  defineButtonComponent,
  defineCardComponent,
  defineDatePickerComponent,
  defineFilePickerComponent,
  defineIconButtonComponent,
  IconRegistry,
  defineInlineMessageComponent,
  defineTableComponent,
  defineListComponent,
  defineTextFieldComponent,
  defineToolbarComponent,
} from '@tylertech/forge'
import { tylIconTylerTalkingTLogo } from '@tylertech/tyler-icons'
import { BrowserRouter } from 'react-router-dom'

IconRegistry.define([tylIconTylerTalkingTLogo])

defineAppBarComponent()
defineIconComponent()
defineButtonComponent()
defineCardComponent()
defineDatePickerComponent()
defineFilePickerComponent()
defineIconButtonComponent()
defineInlineMessageComponent()
defineListComponent()
defineTableComponent()
defineTextFieldComponent()
defineToolbarComponent()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
