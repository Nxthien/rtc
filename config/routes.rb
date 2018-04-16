Rails.application.routes.draw do
  get 'video/create'
  mount ActionCable.server, at: '/cable'
  devise_for :users

  resources :chatrooms do
    resource :chatroom_users
    resources :messages
  end
  resources :videos, only: :create
  resources :direct_messages

  root to: "chatrooms#index"
end
