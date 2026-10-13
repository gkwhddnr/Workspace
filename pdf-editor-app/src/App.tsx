import {useMaterialStore,syncMaterialDesign} from './store/useMaterialStore';
import React,{useLayoutEffect} from 'react';
import {useEditorUiStore,syncEditorUi} from './store/useEditorUiStore';
import './components/EditorUiCustomization.css';
import MainLayout from './layouts/MainLayout';

function App() {
    const design=useEditorUiStore(state=>state.design);
    useLayoutEffect(()=>{syncEditorUi(design);},[design]);
    const material=useMaterialStore();
    useLayoutEffect(()=>syncMaterialDesign(material.design,material.enabled),[material.design,material.enabled]);
    return (
        <MainLayout />
    );
}

export default App;
