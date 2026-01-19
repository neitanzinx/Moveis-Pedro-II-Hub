import React, { useState, createContext, useContext, useCallback } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [state, setState] = useState({
        isOpen: false,
        title: "Confirmar",
        message: "",
        confirmText: "Confirmar",
        cancelText: "Cancelar",
        variant: "default", // "default" | "destructive"
        onConfirm: null,
        onCancel: null,
    });

    const confirm = useCallback(({
        title = "Confirmar",
        message,
        confirmText = "Confirmar",
        cancelText = "Cancelar",
        variant = "default"
    }) => {
        return new Promise((resolve) => {
            setState({
                isOpen: true,
                title,
                message,
                confirmText,
                cancelText,
                variant,
                onConfirm: () => {
                    setState(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setState(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                },
            });
        });
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <AlertDialog open={state.isOpen} onOpenChange={(open) => {
                if (!open) state.onCancel?.();
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{state.title}</AlertDialogTitle>
                        <AlertDialogDescription className="whitespace-pre-line">
                            {state.message}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={state.onCancel}>
                            {state.cancelText}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={state.onConfirm}
                            className={state.variant === "destructive" ? "bg-red-600 hover:bg-red-700" : ""}
                            style={state.variant !== "destructive" ? { background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' } : {}}
                        >
                            {state.confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within a ConfirmProvider");
    }
    return context;
}
