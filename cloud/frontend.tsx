import {createRoot} from 'react-dom/client';
import Workspace from '../apps/web/src/workspace';
import '../apps/web/app/globals.css';
import '../apps/web/app/form-polish.css';
createRoot(document.getElementById('root')!).render(<Workspace/>);
